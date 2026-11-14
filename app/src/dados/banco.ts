import { createStore } from 'zustand/vanilla';

import { dataBR, mesDe } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { limparTexto, normalizar } from '@/core/texto';
import {
  CONFIG_PADRAO, Configuracoes, Lancamento, Membro, Responsavel, Usuario, podeEscrever,
} from '@/core/tipos';
import { DadosValidados } from '@/core/validacao';

import { Armazenamento } from './armazenamento';
import { ErroRemoto, Remoto } from './remoto';

/**
 * BANCO LOCAL + SINCRONIZAÇÃO
 *
 * Tudo o que o app mostra vem daqui (memória + cópia no aparelho), então funciona sem internet.
 * Cada gravação: 1) muda os dados locais na hora; 2) entra numa FILA guardada no aparelho;
 * 3) é enviada ao servidor quando houver internet. Os envios podem ser repetidos sem duplicar
 * (cada lançamento tem um ID criado no celular).
 */

// ---------------------------------------------------------------- tipos

export type Operacao = { uid: string; rotulo: string; tentativas?: number } & (
  | { op: 'lancamento.gravar'; id: string; novo: boolean }
  | { op: 'lancamento.excluir'; id: string }
  | { op: 'membro.gravar'; id: string; novo: boolean }
  | { op: 'membro.excluir'; id: string }
  | { op: 'comprovante.enviar'; id: string; caminho: string; uri: string }
);

export interface Rejeitada {
  rotulo: string;
  motivo: string;
  quando: string;
}

export interface EstadoSinc {
  andamento: boolean;
  /** false quando a última tentativa falhou por falta de internet. */
  online: boolean;
  ultimoSucesso: string | null;
  erro: string | null;
}

export interface Estado {
  /** Os dados guardados no aparelho já foram lidos. */
  carregado: boolean;
  dono: string | null;
  /** Linha da lista de usuários (null = conta não autorizada ou ainda não conferida). */
  usuario: Usuario | null;
  /** Já sabemos (pelo servidor ou pela cópia local) se a conta é autorizada. */
  autorizacaoConhecida: boolean;
  lancamentos: Record<string, Lancamento>;
  membros: Record<string, Membro>;
  responsaveis: Responsavel[];
  config: Configuracoes;
  fila: Operacao[];
  rejeitadas: Rejeitada[];
  cursores: { lancamentos: string | null; membros: string | null };
  sinc: EstadoSinc;
}

export interface Dependencias {
  remoto: Remoto;
  armazenamento: Armazenamento;
  novoId: () => string;
  agora?: () => Date;
  /** Apaga a cópia local de uma foto depois de enviada. */
  removerArquivo?: (uri: string) => Promise<void>;
  /** Tentar enviar logo depois de cada gravação (padrão: sim). Os testes desligam para controlar a ordem. */
  enviarAoGravar?: boolean;
}

export interface DadosMembro {
  id?: string;
  nome: string;
  telefone?: string;
  observacao?: string;
  ativo?: boolean;
}

const PREFIXO = 'adrer1:';
const CHAVE_META = PREFIXO + 'meta';
const CHAVE_FILA = PREFIXO + 'fila';
const CHAVE_MEMBROS = PREFIXO + 'membros';
const PREFIXO_MES = PREFIXO + 'l:';
/** A cada sincronização, relê os últimos minutos (gravações quase simultâneas não se perdem). */
const MARGEM_MS = 2 * 60 * 1000;
const MAX_TENTATIVAS = 4;

function estadoInicial(): Estado {
  return {
    carregado: false,
    dono: null,
    usuario: null,
    autorizacaoConhecida: false,
    lancamentos: {},
    membros: {},
    responsaveis: [],
    config: { ...CONFIG_PADRAO },
    fila: [],
    rejeitadas: [],
    cursores: { lancamentos: null, membros: null },
    sinc: { andamento: false, online: true, ultimoSucesso: null, erro: null },
  };
}

function lerJson<T>(texto: string | null | undefined, padrao: T): T {
  if (!texto) return padrao;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return padrao;
  }
}

function rotuloLancamento(l: Pick<Lancamento, 'tipo' | 'categoria' | 'descricao' | 'valorCentavos' | 'dataReferencia'>): string {
  const oQue = l.tipo === 'Entrada' ? l.categoria + (l.descricao ? ' de ' + l.descricao : '') : l.descricao;
  return oQue + ' · ' + formatarReais(l.valorCentavos) + ' · ' + dataBR(l.dataReferencia);
}

function maiorData(atual: string | null, linhas: { atualizadoEm: string }[]): string | null {
  let maior = atual ? Date.parse(atual) : 0;
  for (const l of linhas) {
    const t = Date.parse(l.atualizadoEm);
    if (t > maior) maior = t;
  }
  return maior ? new Date(maior).toISOString() : null;
}

// ---------------------------------------------------------------- banco

export function criarBanco(dep: Dependencias) {
  const { remoto, armazenamento: arm, novoId } = dep;
  const agora = dep.agora ?? (() => new Date());
  const loja = createStore<Estado>(() => estadoInicial());
  const get = loja.getState;
  const set = loja.setState;

  // ---------- gravação no aparelho ----------

  const sujo = { meta: false, fila: false, membros: false, meses: new Set<string>() };
  let escrita: Promise<void> = Promise.resolve();

  function gravarDisco(): Promise<void> {
    escrita = escrita
      .then(async () => {
        const e = get();
        if (!e.carregado) return;
        const pares: Record<string, string> = {};
        const remover: string[] = [];
        if (sujo.meta) {
          pares[CHAVE_META] = JSON.stringify({
            dono: e.dono, usuario: e.usuario, autorizacaoConhecida: e.autorizacaoConhecida,
            responsaveis: e.responsaveis, config: e.config, cursores: e.cursores,
            ultimoSucesso: e.sinc.ultimoSucesso,
          });
        }
        if (sujo.fila) pares[CHAVE_FILA] = JSON.stringify({ fila: e.fila, rejeitadas: e.rejeitadas });
        if (sujo.membros) pares[CHAVE_MEMBROS] = JSON.stringify(Object.values(e.membros));
        if (sujo.meses.size) {
          const blocos = new Map<string, Lancamento[]>();
          for (const mes of sujo.meses) blocos.set(mes, []);
          for (const l of Object.values(e.lancamentos)) blocos.get(mesDe(l.dataReferencia))?.push(l);
          for (const [mes, lista] of blocos) {
            if (lista.length) pares[PREFIXO_MES + mes] = JSON.stringify(lista);
            else remover.push(PREFIXO_MES + mes);
          }
        }
        sujo.meta = sujo.fila = sujo.membros = false;
        sujo.meses = new Set();
        if (Object.keys(pares).length) await arm.gravar(pares);
        if (remover.length) await arm.remover(remover);
      })
      .catch(() => {
        /* disco cheio ou indisponível: os dados continuam na memória e na próxima gravação tentamos de novo */
      });
    return escrita;
  }

  async function limparDisco(): Promise<void> {
    await arm.remover(await arm.chaves(PREFIXO));
  }

  /** Lê os dados guardados no aparelho para a conta `dono`. Se eram de outra conta, apaga. */
  async function carregar(dono: string): Promise<void> {
    dono = dono.toLowerCase();
    const basicos = await arm.ler([CHAVE_META, CHAVE_FILA, CHAVE_MEMBROS]);
    const meta = lerJson<any>(basicos[CHAVE_META], null);
    if (!meta || meta.dono !== dono) {
      await limparDisco();
      set({ ...estadoInicial(), carregado: true, dono });
      sujo.meta = true;
      await gravarDisco();
      return;
    }
    const chavesMes = await arm.chaves(PREFIXO_MES);
    const blocos = chavesMes.length ? await arm.ler(chavesMes) : {};
    const lancamentos: Record<string, Lancamento> = {};
    for (const chave of chavesMes) {
      for (const l of lerJson<Lancamento[]>(blocos[chave], [])) lancamentos[l.id] = l;
    }
    const membros: Record<string, Membro> = {};
    for (const m of lerJson<Membro[]>(basicos[CHAVE_MEMBROS], [])) membros[m.id] = m;
    const f = lerJson<{ fila: Operacao[]; rejeitadas: Rejeitada[] }>(basicos[CHAVE_FILA], { fila: [], rejeitadas: [] });
    set({
      ...estadoInicial(),
      carregado: true,
      dono,
      usuario: meta.usuario ?? null,
      autorizacaoConhecida: !!meta.autorizacaoConhecida,
      lancamentos,
      membros,
      responsaveis: meta.responsaveis ?? [],
      config: { ...CONFIG_PADRAO, ...(meta.config ?? {}) },
      fila: f.fila ?? [],
      rejeitadas: f.rejeitadas ?? [],
      cursores: meta.cursores ?? { lancamentos: null, membros: null },
      sinc: { andamento: false, online: true, ultimoSucesso: meta.ultimoSucesso ?? null, erro: null },
    });
  }

  /** Sai da conta: apaga tudo do aparelho. */
  async function limparTudo(): Promise<void> {
    await escrita;
    await limparDisco();
    set(estadoInicial());
  }

  // ---------- gravações (funcionam sem internet) ----------

  function aposGravar() {
    if (dep.enviarAoGravar !== false) void sincronizar();
  }

  function exigirEscrita() {
    if (!podeEscrever(get().usuario?.papel)) {
      throw new Error('Sua conta só pode consultar. Peça ao administrador para liberar os lançamentos.');
    }
  }

  function membroPorNome(nome: string, ignorarId?: string): Membro | undefined {
    const alvo = normalizar(nome);
    if (!alvo) return undefined;
    return Object.values(get().membros).find((m) => !m.excluidoEm && m.id !== ignorarId && normalizar(m.nome) === alvo);
  }

  /** Para uma Entrada com nome: usa o membro que já existe ou cadastra um novo. */
  function resolverMembro(dados: DadosValidados, ops: Operacao[], membros: Record<string, Membro>) {
    if (dados.tipo !== 'Entrada' || !dados.descricao) return { membroId: null as string | null, descricao: dados.descricao };
    const existente = membroPorNome(dados.descricao);
    if (existente) return { membroId: existente.id, descricao: existente.nome };
    const carimbo = agora().toISOString();
    const novo: Membro = {
      id: novoId(), nome: dados.descricao, telefone: '', observacao: '', ativo: true,
      criadoEm: carimbo, atualizadoEm: carimbo, excluidoEm: null, pendente: true,
    };
    membros[novo.id] = novo;
    ops.push({ uid: novoId(), op: 'membro.gravar', id: novo.id, novo: true, rotulo: 'Cadastro de ' + novo.nome });
    return { membroId: novo.id, descricao: novo.nome };
  }

  function caminhoComprovante(id: string, dataReferencia: string): string {
    return dataReferencia.slice(0, 4) + '/' + dataReferencia.slice(5, 7) + '/' + id + '-' + novoId().slice(0, 8) + '.jpg';
  }

  async function adicionarLancamento(dados: DadosValidados, extra: { comprovanteUri?: string | null } = {}): Promise<Lancamento> {
    exigirEscrita();
    const e = get();
    const ops: Operacao[] = [];
    const membros = { ...e.membros };
    const { membroId, descricao } = resolverMembro(dados, ops, membros);
    const id = novoId();
    const carimbo = agora().toISOString();
    const caminho = extra.comprovanteUri ? caminhoComprovante(id, dados.dataReferencia) : null;
    const l: Lancamento = {
      id,
      dataReferencia: dados.dataReferencia,
      tipo: dados.tipo,
      categoria: dados.categoria,
      descricao,
      membroId,
      valorCentavos: dados.valorCentavos,
      responsavel: dados.responsavel,
      comprovante: caminho,
      usuarioEmail: e.usuario?.email ?? e.dono ?? '',
      criadoEm: carimbo,
      atualizadoEm: carimbo,
      excluidoEm: null,
      excluidoPor: null,
      pendente: true,
      comprovanteLocal: extra.comprovanteUri ?? null,
    };
    ops.push({ uid: novoId(), op: 'lancamento.gravar', id, novo: true, rotulo: rotuloLancamento(l) });
    if (caminho && extra.comprovanteUri) {
      ops.push({ uid: novoId(), op: 'comprovante.enviar', id, caminho, uri: extra.comprovanteUri, rotulo: 'Foto de ' + rotuloLancamento(l) });
    }
    set({ lancamentos: { ...e.lancamentos, [id]: l }, membros, fila: e.fila.concat(ops) });
    sujo.fila = true;
    sujo.membros = sujo.membros || ops.some((o) => o.op === 'membro.gravar');
    sujo.meses.add(mesDe(l.dataReferencia));
    await gravarDisco();
    aposGravar();
    return l;
  }

  /** Altera um lançamento. `comprovanteUri`: undefined = mantém a foto; texto = troca; null = remove. */
  async function editarLancamento(id: string, dados: DadosValidados, extra: { comprovanteUri?: string | null } = {}): Promise<Lancamento> {
    exigirEscrita();
    const e = get();
    const antigo = e.lancamentos[id];
    if (!antigo) throw new Error('Este lançamento não existe mais. Talvez tenha sido excluído por outra pessoa.');
    const ops: Operacao[] = [];
    const membros = { ...e.membros };
    const { membroId, descricao } = resolverMembro(dados, ops, membros);
    let comprovante = antigo.comprovante;
    let comprovanteLocal = antigo.comprovanteLocal ?? null;
    let fila = e.fila;
    if (extra.comprovanteUri !== undefined) {
      fila = fila.filter((o) => !(o.op === 'comprovante.enviar' && o.id === id && o !== emEnvio));
      comprovante = extra.comprovanteUri ? caminhoComprovante(id, dados.dataReferencia) : null;
      comprovanteLocal = extra.comprovanteUri;
    }
    const l: Lancamento = {
      ...antigo,
      dataReferencia: dados.dataReferencia,
      tipo: dados.tipo,
      categoria: dados.categoria,
      descricao,
      membroId,
      valorCentavos: dados.valorCentavos,
      responsavel: dados.responsavel,
      comprovante,
      comprovanteLocal,
      pendente: true,
    };
    ops.push({ uid: novoId(), op: 'lancamento.gravar', id, novo: false, rotulo: 'Alteração de ' + rotuloLancamento(l) });
    if (extra.comprovanteUri && comprovante) {
      ops.push({ uid: novoId(), op: 'comprovante.enviar', id, caminho: comprovante, uri: extra.comprovanteUri, rotulo: 'Foto de ' + rotuloLancamento(l) });
    }
    set({ lancamentos: { ...e.lancamentos, [id]: l }, membros, fila: fila.concat(ops) });
    sujo.fila = true;
    sujo.membros = sujo.membros || ops.some((o) => o.op === 'membro.gravar');
    sujo.meses.add(mesDe(antigo.dataReferencia));
    sujo.meses.add(mesDe(l.dataReferencia));
    await gravarDisco();
    aposGravar();
    return l;
  }

  async function excluirLancamento(id: string): Promise<void> {
    exigirEscrita();
    const e = get();
    const l = e.lancamentos[id];
    if (!l) return;
    // Se o lançamento nem chegou a ser enviado, basta desistir do envio.
    const criacao = e.fila.find((o) => o.op === 'lancamento.gravar' && o.id === id && o.novo);
    const nuncaEnviado = !!criacao && criacao !== emEnvio;
    const fila = e.fila.filter(
      (o) => o === emEnvio || !(o.id === id && (o.op === 'lancamento.gravar' || o.op === 'comprovante.enviar')),
    );
    if (!nuncaEnviado) {
      fila.push({ uid: novoId(), op: 'lancamento.excluir', id, rotulo: 'Exclusão de ' + rotuloLancamento(l) });
    }
    const lancamentos = { ...e.lancamentos };
    delete lancamentos[id];
    set({ lancamentos, fila });
    sujo.fila = true;
    sujo.meses.add(mesDe(l.dataReferencia));
    await gravarDisco();
    if (l.comprovanteLocal && nuncaEnviado) void dep.removerArquivo?.(l.comprovanteLocal).catch(() => {});
    aposGravar();
  }

  /** Cadastra ou altera um membro. Renomear atualiza os lançamentos ligados a ele. */
  async function salvarMembro(dados: DadosMembro): Promise<Membro> {
    exigirEscrita();
    const e = get();
    const nome = limparTexto(dados.nome);
    if (!nome) throw new Error('Escreva o nome.');
    if (nome.length > 120) throw new Error('O nome está muito longo (máximo de 120 letras).');
    if (membroPorNome(nome, dados.id)) throw new Error('Já existe um cadastro com esse nome.');
    const antigo = dados.id ? e.membros[dados.id] : undefined;
    if (dados.id && !antigo) throw new Error('Este cadastro não existe mais.');
    const carimbo = agora().toISOString();
    const m: Membro = {
      id: antigo?.id ?? novoId(),
      nome,
      telefone: limparTexto(dados.telefone ?? antigo?.telefone ?? '').slice(0, 40),
      observacao: limparTexto(dados.observacao ?? antigo?.observacao ?? '').slice(0, 500),
      ativo: dados.ativo ?? antigo?.ativo ?? true,
      criadoEm: antigo?.criadoEm ?? carimbo,
      atualizadoEm: carimbo,
      excluidoEm: null,
      pendente: true,
    };
    let lancamentos = e.lancamentos;
    if (antigo && antigo.nome !== m.nome) {
      lancamentos = { ...lancamentos };
      for (const l of Object.values(e.lancamentos)) {
        if (l.membroId === m.id && l.descricao !== m.nome) {
          lancamentos[l.id] = { ...l, descricao: m.nome };
          sujo.meses.add(mesDe(l.dataReferencia));
        }
      }
    }
    const op: Operacao = {
      uid: novoId(), op: 'membro.gravar', id: m.id, novo: !antigo,
      rotulo: (antigo ? 'Alteração do cadastro de ' : 'Cadastro de ') + m.nome,
    };
    set({ membros: { ...e.membros, [m.id]: m }, lancamentos, fila: e.fila.concat([op]) });
    sujo.fila = sujo.membros = true;
    await gravarDisco();
    aposGravar();
    return m;
  }

  async function excluirMembro(id: string): Promise<void> {
    exigirEscrita();
    const e = get();
    const m = e.membros[id];
    if (!m) return;
    const criacao = e.fila.find((o) => o.op === 'membro.gravar' && o.id === id && o.novo);
    const emUso = Object.values(e.lancamentos).some((l) => l.membroId === id);
    const nuncaEnviado = !!criacao && criacao !== emEnvio && !emUso;
    const fila = e.fila.filter((o) => o === emEnvio || !(o.op === 'membro.gravar' && o.id === id && nuncaEnviado));
    if (!nuncaEnviado) fila.push({ uid: novoId(), op: 'membro.excluir', id, rotulo: 'Exclusão do cadastro de ' + m.nome });
    const membros = { ...e.membros };
    delete membros[id];
    set({ membros, fila });
    sujo.fila = sujo.membros = true;
    await gravarDisco();
    aposGravar();
  }

  async function descartarRejeitadas(): Promise<void> {
    set({ rejeitadas: [] });
    sujo.fila = true;
    await gravarDisco();
  }

  // ---------- sincronização ----------

  let emEnvio: Operacao | null = null;
  let rodando: Promise<void> | null = null;
  let pedirDeNovo = false;

  /** Envia a fila e baixa as novidades. Chamadas simultâneas viram uma só. */
  function sincronizar(): Promise<void> {
    if (!get().carregado) return Promise.resolve();
    if (rodando) {
      pedirDeNovo = true;
      return rodando;
    }
    rodando = (async () => {
      do {
        pedirDeNovo = false;
        await rodada();
      } while (pedirDeNovo); // alguém pediu de novo enquanto rodava (ex.: a internet voltou)
    })().finally(() => {
      rodando = null;
    });
    return rodando;
  }

  function definirSinc(parte: Partial<EstadoSinc>) {
    set({ sinc: { ...get().sinc, ...parte } });
  }

  async function rodada(): Promise<void> {
    definirSinc({ andamento: true, erro: null });
    try {
      const usuario = await remoto.meuUsuario();
      set({ usuario, autorizacaoConhecida: true });
      sujo.meta = true;
      if (usuario) {
        await enviarFila();
        await baixar();
      }
      definirSinc({ andamento: false, online: true, erro: null, ultimoSucesso: agora().toISOString() });
    } catch (erro) {
      const tipo = erro instanceof ErroRemoto ? erro.tipo : 'outro';
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (tipo === 'rede') definirSinc({ andamento: false, online: false, erro: null });
      else if (tipo === 'sessao') definirSinc({ andamento: false, online: true, erro: 'Sua sessão expirou. Saia e entre de novo no app.' });
      else definirSinc({ andamento: false, online: true, erro: 'Não foi possível sincronizar. (Detalhe: ' + mensagem + ')' });
    }
    sujo.meta = true;
    await gravarDisco();
  }

  function tirarDaFila(op: Operacao) {
    set({ fila: get().fila.filter((o) => o.uid !== op.uid) });
    sujo.fila = true;
  }

  async function executar(op: Operacao): Promise<void> {
    const e = get();
    switch (op.op) {
      case 'lancamento.gravar': {
        const l = e.lancamentos[op.id];
        if (!l) return; // foi excluído antes de ser enviado
        await remoto.gravarLancamento({
          id: l.id, dataReferencia: l.dataReferencia, tipo: l.tipo, categoria: l.categoria, descricao: l.descricao,
          membroId: l.membroId, valorCentavos: l.valorCentavos, responsavel: l.responsavel,
          comprovante: l.comprovante, criadoEm: l.criadoEm,
        });
        return;
      }
      case 'lancamento.excluir':
        await remoto.excluirLancamento(op.id);
        return;
      case 'membro.gravar': {
        const m = e.membros[op.id];
        if (!m) return;
        await remoto.gravarMembro({ id: m.id, nome: m.nome, telefone: m.telefone, observacao: m.observacao, ativo: m.ativo });
        return;
      }
      case 'membro.excluir':
        await remoto.excluirMembro(op.id);
        return;
      case 'comprovante.enviar':
        await remoto.enviarComprovante(op.caminho, op.uri);
        return;
    }
  }

  /** Depois de enviado: tira a marca de "pendente" se não houver mais nada na fila para o mesmo item. */
  function concluir(op: Operacao) {
    tirarDaFila(op);
    const e = get();
    const aindaNaFila = e.fila.some((o) => o.id === op.id);
    if (op.op === 'comprovante.enviar') {
      const l = e.lancamentos[op.id];
      if (l && l.comprovante === op.caminho) {
        set({ lancamentos: { ...e.lancamentos, [l.id]: { ...l, comprovanteLocal: null, pendente: aindaNaFila } } });
        sujo.meses.add(mesDe(l.dataReferencia));
      }
      void dep.removerArquivo?.(op.uri).catch(() => {});
      return;
    }
    if (aindaNaFila) return;
    if (op.op === 'lancamento.gravar') {
      const l = e.lancamentos[op.id];
      if (l?.pendente) {
        set({ lancamentos: { ...e.lancamentos, [l.id]: { ...l, pendente: false } } });
        sujo.meses.add(mesDe(l.dataReferencia));
      }
    } else if (op.op === 'membro.gravar') {
      const m = e.membros[op.id];
      if (m?.pendente) {
        set({ membros: { ...e.membros, [m.id]: { ...m, pendente: false } } });
        sujo.membros = true;
      }
    }
  }

  /** O servidor recusou: guarda o aviso, desfaz a mudança local e manda recarregar tudo. */
  function rejeitar(op: Operacao, motivo: string) {
    tirarDaFila(op);
    const e = get();
    const rejeitadas = e.rejeitadas.concat([{ rotulo: op.rotulo, motivo, quando: agora().toISOString() }]).slice(-20);
    const parte: Partial<Estado> = { rejeitadas, cursores: { lancamentos: null, membros: null } };
    if (op.op === 'lancamento.gravar' && op.novo && e.lancamentos[op.id]) {
      const l = e.lancamentos[op.id];
      const lancamentos = { ...e.lancamentos };
      delete lancamentos[op.id];
      parte.lancamentos = lancamentos;
      parte.fila = get().fila.filter((o) => o.id !== op.id);
      sujo.meses.add(mesDe(l.dataReferencia));
    } else if (op.op === 'membro.gravar' && op.novo && e.membros[op.id]) {
      const membros = { ...e.membros };
      delete membros[op.id];
      parte.membros = membros;
      sujo.membros = true;
    }
    set(parte);
    sujo.meta = sujo.fila = true;
  }

  async function enviarFila(): Promise<void> {
    for (;;) {
      const op = get().fila[0];
      if (!op) break;
      emEnvio = op;
      try {
        await executar(op);
        emEnvio = null;
        concluir(op);
      } catch (erro) {
        emEnvio = null;
        const tipo = erro instanceof ErroRemoto ? erro.tipo : 'outro';
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        if (tipo === 'rede' || tipo === 'sessao') throw erro;
        if (tipo === 'outro' && (op.tentativas ?? 0) + 1 < MAX_TENTATIVAS) {
          // Erro desconhecido: tenta de novo nas próximas sincronizações antes de desistir.
          set({ fila: get().fila.map((o) => (o.uid === op.uid ? { ...o, tentativas: (o.tentativas ?? 0) + 1 } : o)) });
          sujo.fila = true;
          await gravarDisco();
          throw erro;
        }
        rejeitar(op, mensagem);
      }
      await gravarDisco();
    }
  }

  async function baixar(): Promise<void> {
    const antes = get().cursores;
    const desde = (cursor: string | null) => (cursor ? new Date(Date.parse(cursor) - MARGEM_MS).toISOString() : null);
    const [responsaveis, linhasConfig, membrosNovos, lancNovos] = await Promise.all([
      remoto.responsaveis(),
      remoto.configuracoes(),
      remoto.membrosAlterados(desde(antes.membros)),
      remoto.lancamentosAlterados(desde(antes.lancamentos)),
    ]);

    const e = get();
    // O que ainda está na fila (não enviado) vale mais que a versão do servidor.
    const pendentes = new Set(e.fila.map((o) => o.id));

    const config: Configuracoes = { ...CONFIG_PADRAO };
    for (const c of linhasConfig) {
      if (c.chave === 'saldo_abertura_centavos') config.saldoAberturaCentavos = Math.round(Number(c.valor)) || 0;
      else if (c.chave === 'responsavel_padrao') config.responsavelPadrao = typeof c.valor === 'string' ? c.valor : '';
    }

    const membros = { ...e.membros };
    if (!antes.membros) {
      const noServidor = new Set(membrosNovos.map((m) => m.id));
      for (const id of Object.keys(membros)) if (!noServidor.has(id) && !pendentes.has(id)) delete membros[id];
    }
    for (const m of membrosNovos) {
      if (pendentes.has(m.id)) continue;
      if (m.excluidoEm) delete membros[m.id];
      else membros[m.id] = m;
    }

    const lancamentos = { ...e.lancamentos };
    if (!antes.lancamentos) {
      const noServidor = new Set(lancNovos.map((l) => l.id));
      for (const [id, l] of Object.entries(lancamentos)) {
        if (!noServidor.has(id) && !pendentes.has(id)) {
          delete lancamentos[id];
          sujo.meses.add(mesDe(l.dataReferencia));
        }
      }
    }
    for (const l of lancNovos) {
      if (pendentes.has(l.id)) continue;
      const local = lancamentos[l.id];
      if (local) sujo.meses.add(mesDe(local.dataReferencia));
      if (l.excluidoEm) {
        delete lancamentos[l.id];
      } else {
        lancamentos[l.id] = l;
        sujo.meses.add(mesDe(l.dataReferencia));
      }
    }

    set({
      responsaveis: responsaveis.slice().sort((a, b) => a.ordem - b.ordem || (a.nome < b.nome ? -1 : 1)),
      config,
      membros,
      lancamentos,
      cursores: {
        membros: maiorData(antes.membros, membrosNovos) ?? antes.membros,
        lancamentos: maiorData(antes.lancamentos, lancNovos) ?? antes.lancamentos,
      },
    });
    sujo.meta = sujo.membros = true;
  }

  /** Avisado pelo aparelho quando a internet cai ou volta. */
  function definirOnline(online: boolean) {
    if (online) {
      if (!get().sinc.online || get().fila.length) void sincronizar();
    } else {
      definirSinc({ online: false });
    }
  }

  /** Apaga a cópia local e baixa tudo de novo (o que ainda não foi enviado é mantido). */
  async function recarregarTudo(): Promise<void> {
    set({ cursores: { lancamentos: null, membros: null } });
    sujo.meta = true;
    await sincronizar();
  }

  return {
    loja,
    remoto,
    carregar,
    limparTudo,
    sincronizar,
    recarregarTudo,
    definirOnline,
    adicionarLancamento,
    editarLancamento,
    excluirLancamento,
    salvarMembro,
    excluirMembro,
    descartarRejeitadas,
    /** Espera as gravações no aparelho terminarem (testes). */
    aguardarDisco: () => escrita,
  };
}

export type Banco = ReturnType<typeof criarBanco>;
