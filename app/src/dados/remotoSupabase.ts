import type { SupabaseClient } from '@supabase/supabase-js';

import { Lancamento, Membro, Responsavel, Usuario } from '@/core/tipos';

import {
  ErroRemoto, LancamentoEnvio, LinhaConfig, MembroEnvio, Remoto, ResponsavelEnvio, UsuarioEnvio,
} from './remoto';

/** Servidor de verdade: tabelas do Supabase (veja supabase/migracoes). */

const BUCKET = 'comprovantes';

const MENSAGENS_REGRA: Record<string, string> = {
  lanc_tipo_categoria: 'Tipo e categoria não combinam.',
  lanc_valor: 'Valor inválido (precisa ser maior que zero e até R$ 1.000.000,00).',
  lanc_descricao: 'Falta a descrição da despesa ou o nome de quem deu o dízimo.',
  lanc_responsavel: 'Falta o responsável.',
  lanc_data: 'Data fora do período aceito.',
  membros_nome_valido: 'O nome do cadastro é obrigatório.',
  responsaveis_nome_unico: 'Já existe um responsável com esse nome.',
  responsaveis_nome_valido: 'O nome do responsável é obrigatório.',
  usuarios_email_valido: 'E-mail inválido.',
  usuarios_pkey: 'Esse e-mail já está na lista.',
};

/** Traduz qualquer erro do Supabase para os tipos que o app entende. */
export function converterErro(erro: any, status?: number): ErroRemoto {
  if (erro instanceof ErroRemoto) return erro;
  const mensagem = String(erro?.message ?? erro ?? '');
  const codigo = String(erro?.code ?? '');
  const st = Number(status ?? erro?.status ?? erro?.statusCode ?? NaN);
  if (st === 0 || /network request failed|failed to fetch|fetch failed|networkerror|load failed|timed? ?out|aborted|socket|ENOTFOUND|ECONN/i.test(mensagem)) {
    return new ErroRemoto('rede', 'Sem conexão com a internet.');
  }
  if (st === 401 || codigo === 'PGRST301' || codigo === 'PGRST302' || /jwt expired|invalid jwt|invalid claim|not authenticated/i.test(mensagem)) {
    return new ErroRemoto('sessao', 'Login expirado.');
  }
  if (codigo === '42501' || st === 403 || /row-level security|permission denied/i.test(mensagem)) {
    return new ErroRemoto('permissao', 'Sua conta não tem permissão para fazer isso.');
  }
  if (/^(22|23)/.test(codigo) || /manter pelo menos um administrador/i.test(mensagem)) {
    const regra = Object.keys(MENSAGENS_REGRA).find((r) => mensagem.includes(r));
    if (regra) return new ErroRemoto('validacao', MENSAGENS_REGRA[regra]);
    if (/administrador/i.test(mensagem)) return new ErroRemoto('validacao', 'É preciso manter pelo menos um administrador ativo.');
    return new ErroRemoto('validacao', 'O servidor recusou os dados. (Detalhe: ' + mensagem + ')');
  }
  if (st >= 500 || st === 429) return new ErroRemoto('rede', 'Servidor indisponível no momento.');
  return new ErroRemoto('outro', mensagem || 'Erro desconhecido.');
}

function paraLancamento(l: any): Lancamento {
  return {
    id: l.id,
    dataReferencia: l.data_referencia,
    tipo: l.tipo,
    categoria: l.categoria,
    descricao: l.descricao ?? '',
    membroId: l.membro_id ?? null,
    valorCentavos: Number(l.valor_centavos),
    responsavel: l.responsavel ?? '',
    comprovante: l.comprovante ?? null,
    usuarioEmail: l.usuario_email ?? '',
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
    excluidoEm: l.excluido_em ?? null,
    excluidoPor: l.excluido_por ?? null,
  };
}

function paraMembro(m: any): Membro {
  return {
    id: m.id, nome: m.nome, telefone: m.telefone ?? '', observacao: m.observacao ?? '', ativo: !!m.ativo,
    criadoEm: m.criado_em, atualizadoEm: m.atualizado_em, excluidoEm: m.excluido_em ?? null,
  };
}

function paraUsuario(u: any): Usuario {
  return { email: u.email, nome: u.nome ?? '', papel: u.papel, ativo: !!u.ativo, atualizadoEm: u.atualizado_em };
}

export interface OpcoesRemotoSupabase {
  /** Linhas por página ao baixar alterações (os testes usam um número pequeno). */
  tamanhoPagina?: number;
  /** Lê o arquivo local da foto (depende da plataforma). */
  lerArquivo: (uri: string) => Promise<ArrayBuffer>;
}

export function criarRemotoSupabase(supabase: SupabaseClient, opcoes: OpcoesRemotoSupabase): Remoto {
  const pagina = opcoes.tamanhoPagina ?? 500;

  /** Executa uma consulta e devolve os dados, convertendo erros. */
  async function rodar<T>(consulta: PromiseLike<{ data: T; error: any; status: number }>): Promise<T> {
    let r;
    try {
      r = await consulta;
    } catch (e) {
      throw converterErro(e);
    }
    if (r.error) throw converterErro(r.error, r.status);
    return r.data;
  }

  /** Baixa tudo o que mudou depois de `desde`, em páginas, sem pular linhas com o mesmo horário. */
  async function alterados(tabela: string, desde: string | null): Promise<any[]> {
    const todas: any[] = [];
    let apos: { ts: string; id: string } | null = null;
    for (;;) {
      let q = supabase.from(tabela).select('*').order('atualizado_em', { ascending: true }).order('id', { ascending: true }).limit(pagina);
      if (apos) q = q.or(`atualizado_em.gt."${apos.ts}",and(atualizado_em.eq."${apos.ts}",id.gt."${apos.id}")`);
      else if (desde) q = q.gt('atualizado_em', desde);
      const linhas = (await rodar<any[] | null>(q)) ?? [];
      todas.push(...linhas);
      if (linhas.length < pagina) break;
      const ultima = linhas[linhas.length - 1];
      apos = { ts: ultima.atualizado_em, id: ultima.id };
    }
    return todas;
  }

  async function emailLogado(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw converterErro(error);
    const email = data.session?.user?.email;
    if (!email) throw new ErroRemoto('sessao', 'Você não está conectado.');
    return email.toLowerCase();
  }

  return {
    async meuUsuario() {
      const email = await emailLogado();
      const linhas = await rodar<any[] | null>(supabase.from('usuarios').select('*').eq('email', email).eq('ativo', true).limit(1));
      return linhas && linhas[0] ? paraUsuario(linhas[0]) : null;
    },

    async lancamentosAlterados(desde) {
      return (await alterados('lancamentos', desde)).map(paraLancamento);
    },

    async membrosAlterados(desde) {
      return (await alterados('membros', desde)).map(paraMembro);
    },

    async responsaveis() {
      const linhas = await rodar<any[] | null>(supabase.from('responsaveis').select('*').order('ordem').order('nome'));
      return (linhas ?? []).map((r): Responsavel => ({ id: r.id, nome: r.nome, ativo: !!r.ativo, ordem: r.ordem, atualizadoEm: r.atualizado_em }));
    },

    async configuracoes() {
      const linhas = await rodar<any[] | null>(supabase.from('configuracoes').select('chave, valor'));
      return (linhas ?? []).map((c): LinhaConfig => ({ chave: c.chave, valor: c.valor }));
    },

    async gravarLancamento(l: LancamentoEnvio) {
      await rodar(supabase.from('lancamentos').upsert({
        id: l.id,
        data_referencia: l.dataReferencia,
        tipo: l.tipo,
        categoria: l.categoria,
        descricao: l.descricao,
        membro_id: l.membroId,
        valor_centavos: l.valorCentavos,
        responsavel: l.responsavel,
        comprovante: l.comprovante,
        criado_em: l.criadoEm,
      }, { onConflict: 'id' }));
    },

    async excluirLancamento(id) {
      await rodar(supabase.from('lancamentos').update({ excluido_em: new Date().toISOString() }).eq('id', id).is('excluido_em', null));
    },

    async gravarMembro(m: MembroEnvio) {
      await rodar(supabase.from('membros').upsert({
        id: m.id, nome: m.nome, telefone: m.telefone, observacao: m.observacao, ativo: m.ativo, excluido_em: null,
      }, { onConflict: 'id' }));
    },

    async excluirMembro(id) {
      await rodar(supabase.from('membros').update({ excluido_em: new Date().toISOString() }).eq('id', id).is('excluido_em', null));
    },

    async enviarComprovante(caminho, uriLocal) {
      let conteudo: ArrayBuffer;
      try {
        conteudo = await opcoes.lerArquivo(uriLocal);
      } catch {
        // A foto sumiu do aparelho (ex.: limpeza de armazenamento): não adianta tentar de novo.
        throw new ErroRemoto('validacao', 'A foto não está mais no aparelho. Tire outra foto no lançamento.');
      }
      let r;
      try {
        r = await supabase.storage.from(BUCKET).upload(caminho, conteudo, { contentType: 'image/jpeg', upsert: true });
      } catch (e) {
        throw converterErro(e);
      }
      if (r.error) throw converterErro(r.error);
    },

    async urlComprovante(caminho) {
      let r;
      try {
        r = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60);
      } catch (e) {
        throw converterErro(e);
      }
      if (r.error || !r.data?.signedUrl) {
        const erro = converterErro(r.error ?? 'Foto não encontrada.');
        throw erro.tipo === 'rede' || erro.tipo === 'sessao' ? erro : new ErroRemoto('outro', 'A foto ainda não foi enviada ou não existe mais.');
      }
      return r.data.signedUrl;
    },

    async listarUsuarios() {
      const linhas = await rodar<any[] | null>(supabase.from('usuarios').select('*').order('nome').order('email'));
      return (linhas ?? []).map(paraUsuario);
    },

    async gravarUsuario(u: UsuarioEnvio) {
      await rodar(supabase.from('usuarios').upsert({ email: u.email.toLowerCase(), nome: u.nome, papel: u.papel, ativo: u.ativo }, { onConflict: 'email' }));
    },

    async removerUsuario(email) {
      await rodar(supabase.from('usuarios').delete().eq('email', email.toLowerCase()));
    },

    async gravarResponsavel(r: ResponsavelEnvio) {
      const linha = { nome: r.nome, ativo: r.ativo, ordem: r.ordem };
      if (r.id) await rodar(supabase.from('responsaveis').update(linha).eq('id', r.id));
      else await rodar(supabase.from('responsaveis').insert(linha));
    },

    async gravarConfiguracao(chave, valor) {
      await rodar(supabase.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' }));
    },
  };
}
