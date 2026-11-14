import { DadosValidados } from '@/core/validacao';

import { Armazenamento, armazenamentoMemoria } from '../armazenamento';
import { criarBanco } from '../banco';
import { RemotoMemoria, ServidorMemoria } from '../remotoMemoria';

const DONO = 'dono@gmail.com';
const TES = 'tesoureiro@gmail.com';
const LEITOR = 'leitor@gmail.com';

function novoServidor() {
  return new ServidorMemoria([
    { email: DONO, nome: 'Dono', papel: 'admin', ativo: true },
    { email: TES, nome: 'Tesoureiro', papel: 'tesoureiro', ativo: true },
    { email: LEITOR, nome: 'Leitor', papel: 'leitor', ativo: true },
  ]);
}

let serie = 0;
/** Um "celular": banco local + conexão com o servidor. */
async function celular(servidor: ServidorMemoria, email = DONO, armazenamento: Armazenamento = armazenamentoMemoria()) {
  const remoto = servidor.conectar(email);
  const removidos: string[] = [];
  const prefixo = (++serie).toString(16).padStart(8, '0');
  let n = 0;
  const banco = criarBanco({
    remoto,
    armazenamento,
    novoId: () => prefixo + '-0000-4000-8000-' + String(++n).padStart(12, '0'),
    removerArquivo: async (uri) => { removidos.push(uri); },
    enviarAoGravar: false, // nos testes, cada envio é pedido explicitamente
  });
  await banco.carregar(email);
  await banco.sincronizar();
  return { banco, remoto, armazenamento, removidos, estado: () => banco.loja.getState() };
}

function dizimo(extra: Partial<DadosValidados> = {}): DadosValidados {
  return { responsavel: 'Alex', valorCentavos: 5000, tipo: 'Entrada', categoria: 'Dízimo', descricao: 'Silvana', dataReferencia: '2026-11-08', ...extra };
}
function despesa(descricao: string, valorCentavos: number, extra: Partial<DadosValidados> = {}): DadosValidados {
  return { responsavel: 'Alex', valorCentavos, tipo: 'Saída', categoria: 'Despesa', descricao, dataReferencia: '2026-11-08', ...extra };
}
const validos = (s: ServidorMemoria) => Array.from(s.lancamentos.values()).filter((l) => !l.excluidoEm);

describe('lançar e sincronizar', () => {
  test('com internet: grava no celular e chega ao servidor', async () => {
    const s = novoServidor();
    const c = await celular(s);
    const l = await c.banco.adicionarLancamento(dizimo());
    expect(c.estado().lancamentos[l.id]).toMatchObject({ valorCentavos: 5000, pendente: true });
    await c.banco.sincronizar();
    expect(validos(s)).toHaveLength(1);
    expect(s.lancamentos.get(l.id)).toMatchObject({ usuarioEmail: DONO, descricao: 'Silvana', responsavel: 'Alex' });
    expect(c.estado().fila).toEqual([]);
    expect(c.estado().lancamentos[l.id].pendente).toBeFalsy();
    expect(c.estado().sinc).toMatchObject({ online: true, erro: null, andamento: false });
    expect(c.estado().sinc.ultimoSucesso).not.toBeNull();
  });

  test('sem internet: fica na fila e é enviado quando a internet volta', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.online = false;
    const a = await c.banco.adicionarLancamento(dizimo());
    const b = await c.banco.adicionarLancamento(despesa('Aluguel', 80000));
    await c.banco.sincronizar();
    expect(validos(s)).toHaveLength(0);
    expect(c.estado().sinc.online).toBe(false);
    expect(c.estado().fila.map((o) => o.op)).toEqual(['membro.gravar', 'lancamento.gravar', 'lancamento.gravar']);
    expect(Object.keys(c.estado().lancamentos)).toHaveLength(2); // aparecem na lista mesmo sem internet

    c.remoto.online = true;
    c.banco.definirOnline(true);
    await c.banco.sincronizar();
    expect(validos(s).map((l) => l.id).sort()).toEqual([a.id, b.id].sort());
    expect(c.estado().fila).toEqual([]);
    expect(c.estado().sinc.online).toBe(true);
  });

  test('resposta perdida: reenviar não duplica', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.falharProxima('gravarLancamento', 'rede', { depois: true }); // gravou, mas o celular não soube
    await c.banco.adicionarLancamento(dizimo());
    await c.banco.sincronizar();
    expect(validos(s)).toHaveLength(1);
    expect(c.estado().fila.some((o) => o.op === 'lancamento.gravar')).toBe(true);
    await c.banco.sincronizar();
    expect(validos(s)).toHaveLength(1);
    expect(c.estado().fila).toEqual([]);
  });

  test('fila sobrevive ao fechamento do app', async () => {
    const s = novoServidor();
    const arm = armazenamentoMemoria();
    const c1 = await celular(s, DONO, arm);
    c1.remoto.online = false;
    const l = await c1.banco.adicionarLancamento(dizimo({ valorCentavos: 12345 }));
    await c1.banco.aguardarDisco();

    const c2 = await celular(s, DONO, arm); // "abre o app de novo" com internet
    expect(validos(s).map((x) => x.id)).toEqual([l.id]);
    expect(c2.estado().lancamentos[l.id].valorCentavos).toBe(12345);
    expect(c2.estado().fila).toEqual([]);
  });

  test('dados ficam guardados no aparelho, separados por mês', async () => {
    const s = novoServidor();
    const arm = armazenamentoMemoria();
    const c = await celular(s, DONO, arm);
    await c.banco.adicionarLancamento(dizimo({ dataReferencia: '2026-10-05' }));
    await c.banco.adicionarLancamento(dizimo({ dataReferencia: '2026-11-08' }));
    await c.banco.sincronizar();
    await c.banco.aguardarDisco();
    expect(Object.keys(arm.dados).sort()).toEqual(['adrer1:fila', 'adrer1:l:2026-10', 'adrer1:l:2026-11', 'adrer1:membros', 'adrer1:meta']);

    c.remoto.online = false; // abre sem internet: tudo continua lá
    const offline = criarBanco({ remoto: c.remoto, armazenamento: arm, novoId: () => 'x' });
    await offline.carregar(DONO);
    expect(Object.keys(offline.loja.getState().lancamentos)).toHaveLength(2);
    expect(offline.loja.getState().usuario?.papel).toBe('admin');
    expect(offline.loja.getState().responsaveis.map((r) => r.nome)).toEqual(['Alex', 'Júlio', 'Lázaro']);
  });

  test('no app, gravar já dispara o envio sozinho', async () => {
    const s = novoServidor();
    const banco = criarBanco({ remoto: s.conectar(DONO), armazenamento: armazenamentoMemoria(), novoId: (() => { let n = 0; return () => 'auto0000-0000-4000-8000-' + String(++n).padStart(12, '0'); })() });
    await banco.carregar(DONO);
    await banco.sincronizar();
    await banco.adicionarLancamento(dizimo());
    await banco.sincronizar(); // só espera o envio que já começou
    expect(validos(s)).toHaveLength(1);
    expect(s.chamadas.gravarLancamento).toBe(1);
  });

  test('pedido de sincronização feito durante outra não se perde (internet voltou no meio)', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.online = false;
    c.remoto.latencia = 5;
    await c.banco.adicionarLancamento(dizimo());
    const primeira = c.banco.sincronizar(); // vai falhar: sem internet
    c.remoto.online = true;
    await Promise.all([primeira, c.banco.sincronizar()]);
    expect(validos(s)).toHaveLength(1);
    expect(c.estado().sinc.online).toBe(true);
  });

  test('chamadas simultâneas de sincronizar viram uma só fila de envio', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.latencia = 5;
    await Promise.all([c.banco.adicionarLancamento(dizimo()), c.banco.adicionarLancamento(despesa('Luz', 100))]);
    await Promise.all([c.banco.sincronizar(), c.banco.sincronizar(), c.banco.sincronizar()]);
    expect(validos(s)).toHaveLength(2);
    expect(s.chamadas.gravarLancamento).toBe(2);
  });
});

describe('dois celulares', () => {
  test('o que um lança aparece no outro; excluir também', async () => {
    const s = novoServidor();
    const a = await celular(s, DONO);
    const b = await celular(s, TES);
    const l = await a.banco.adicionarLancamento(dizimo());
    await a.banco.sincronizar();
    await b.banco.sincronizar();
    expect(b.estado().lancamentos[l.id]).toMatchObject({ descricao: 'Silvana', usuarioEmail: DONO });
    expect(Object.values(b.estado().membros).map((m) => m.nome)).toEqual(['Silvana']);

    await b.banco.excluirLancamento(l.id);
    await b.banco.sincronizar();
    expect(s.lancamentos.get(l.id)).toMatchObject({ excluidoPor: TES });
    expect(s.lancamentos.get(l.id)!.excluidoEm).not.toBeNull();
    await a.banco.sincronizar();
    expect(a.estado().lancamentos[l.id]).toBeUndefined();
  });

  test('os dois lançando sem internet: nada se perde', async () => {
    const s = novoServidor();
    const a = await celular(s, DONO);
    const b = await celular(s, TES);
    a.remoto.online = b.remoto.online = false;
    for (let i = 1; i <= 5; i++) {
      await a.banco.adicionarLancamento(dizimo({ valorCentavos: i * 100, descricao: 'Ana' }));
      await b.banco.adicionarLancamento(despesa('Gasto ' + i, i * 10));
    }
    a.remoto.online = b.remoto.online = true;
    await a.banco.sincronizar();
    await b.banco.sincronizar();
    await a.banco.sincronizar();
    expect(validos(s)).toHaveLength(10);
    expect(Object.keys(a.estado().lancamentos)).toHaveLength(10);
    expect(Object.keys(b.estado().lancamentos)).toHaveLength(10);
  });

  test('baixar novidades não apaga o que ainda está na fila', async () => {
    const s = novoServidor();
    const a = await celular(s, DONO);
    const b = await celular(s, TES);
    const l = await a.banco.adicionarLancamento(dizimo({ valorCentavos: 1000 }));
    await a.banco.sincronizar();
    await b.banco.sincronizar();
    // B altera sem conseguir enviar (erro desconhecido no envio), mas consegue baixar depois
    b.remoto.falharProxima('gravarLancamento', 'outro');
    await b.banco.editarLancamento(l.id, dizimo({ valorCentavos: 2000 }));
    await b.banco.sincronizar();
    expect(b.estado().lancamentos[l.id]).toMatchObject({ valorCentavos: 2000, pendente: true });
    expect(b.estado().sinc.erro).toMatch(/Não foi possível sincronizar/);
    await b.banco.sincronizar();
    expect(s.lancamentos.get(l.id)!.valorCentavos).toBe(2000);
    expect(b.estado().lancamentos[l.id].pendente).toBeFalsy();
    expect(s.lancamentos.get(l.id)!.usuarioEmail).toBe(DONO); // quem lançou continua o mesmo
  });
});

describe('membros (quem contribuiu)', () => {
  test('nome novo vira cadastro; nome repetido (sem acento/maiúscula) reaproveita', async () => {
    const s = novoServidor();
    const c = await celular(s);
    const a = await c.banco.adicionarLancamento(dizimo({ descricao: 'Lázaro Souza' }));
    const b = await c.banco.adicionarLancamento(dizimo({ descricao: 'lazaro  souza'.replace('  ', ' ') }));
    const o = await c.banco.adicionarLancamento(dizimo({ categoria: 'Oferta', descricao: '' }));
    const d = await c.banco.adicionarLancamento(despesa('Lázaro Souza', 100));
    await c.banco.sincronizar();
    expect(s.membros.size).toBe(1);
    expect(a.membroId).toBe(b.membroId);
    expect(b.descricao).toBe('Lázaro Souza'); // usa a grafia do cadastro
    expect(o.membroId).toBeNull();
    expect(d.membroId).toBeNull(); // despesa não cria cadastro
  });

  test('renomear atualiza os lançamentos ligados, no celular e no servidor', async () => {
    const s = novoServidor();
    const a = await celular(s, DONO);
    const b = await celular(s, TES);
    const l = await a.banco.adicionarLancamento(dizimo());
    await a.banco.sincronizar();
    await a.banco.salvarMembro({ id: l.membroId!, nome: 'Silvana Souza', telefone: '(11) 99999-0000' });
    expect(a.estado().lancamentos[l.id].descricao).toBe('Silvana Souza');
    await a.banco.sincronizar();
    expect(s.lancamentos.get(l.id)!.descricao).toBe('Silvana Souza');
    await b.banco.sincronizar();
    expect(b.estado().lancamentos[l.id].descricao).toBe('Silvana Souza');
    expect(b.estado().membros[l.membroId!]).toMatchObject({ nome: 'Silvana Souza', telefone: '(11) 99999-0000' });
  });

  test('não deixa cadastrar dois membros com o mesmo nome; excluir tira da lista', async () => {
    const s = novoServidor();
    const c = await celular(s);
    const m = await c.banco.salvarMembro({ nome: 'Ana' });
    await expect(c.banco.salvarMembro({ nome: ' ANA ' })).rejects.toThrow(/Já existe/);
    await expect(c.banco.salvarMembro({ nome: '  ' })).rejects.toThrow(/Escreva o nome/);
    await c.banco.sincronizar();
    await c.banco.excluirMembro(m.id);
    await c.banco.sincronizar();
    expect(c.estado().membros[m.id]).toBeUndefined();
    expect(s.membros.get(m.id)!.excluidoEm).not.toBeNull();
    await c.banco.salvarMembro({ nome: 'Ana' }); // nome fica livre de novo
  });
});

describe('excluir e alterar', () => {
  test('excluir algo que nem foi enviado só cancela o envio', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.online = false;
    const l = await c.banco.adicionarLancamento(despesa('Errado', 999), { comprovanteUri: 'file:///foto.jpg' });
    expect(c.estado().fila.map((o) => o.op)).toEqual(['lancamento.gravar', 'comprovante.enviar']);
    await c.banco.excluirLancamento(l.id);
    expect(c.estado().fila).toEqual([]);
    expect(c.removidos).toEqual(['file:///foto.jpg']);
    c.remoto.online = true;
    await c.banco.sincronizar();
    expect(s.lancamentos.size).toBe(0);
    expect(s.chamadas.gravarLancamento ?? 0).toBe(0);
  });

  test('alterar muda valor, data (troca de mês) e mantém quem lançou', async () => {
    const s = novoServidor();
    const arm = armazenamentoMemoria();
    const c = await celular(s, DONO, arm);
    const l = await c.banco.adicionarLancamento(despesa('Luz', 10000));
    await c.banco.sincronizar();
    await c.banco.editarLancamento(l.id, despesa('Conta de luz', 12735, { dataReferencia: '2026-10-30' }));
    await c.banco.sincronizar();
    await c.banco.aguardarDisco();
    expect(s.lancamentos.get(l.id)).toMatchObject({ descricao: 'Conta de luz', valorCentavos: 12735, dataReferencia: '2026-10-30' });
    expect(arm.dados['adrer1:l:2026-11']).toBeUndefined();
    expect(JSON.parse(arm.dados['adrer1:l:2026-10'])).toHaveLength(1);
    await expect(c.banco.editarLancamento('nao-existe', despesa('x', 1))).rejects.toThrow(/não existe mais/);
  });
});

describe('recusas do servidor', () => {
  test('lançamento recusado sai da lista, vira aviso e os outros seguem', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.online = false;
    const ruim = await c.banco.adicionarLancamento(despesa('Recusado', 100));
    const bom = await c.banco.adicionarLancamento(despesa('Aceito', 200));
    c.remoto.online = true;
    c.remoto.falharProxima('gravarLancamento', 'validacao', { mensagem: 'Valor inválido.' });
    await c.banco.sincronizar();
    expect(validos(s).map((l) => l.id)).toEqual([bom.id]);
    expect(c.estado().lancamentos[ruim.id]).toBeUndefined();
    expect(c.estado().rejeitadas).toHaveLength(1);
    expect(c.estado().rejeitadas[0]).toMatchObject({ rotulo: 'Recusado · R$ 1,00 · 08/11/2026', motivo: 'Valor inválido.' });
    expect(c.estado().fila).toEqual([]);
    await c.banco.descartarRejeitadas();
    expect(c.estado().rejeitadas).toEqual([]);
  });

  test('exclusão recusada: o lançamento volta para a lista', async () => {
    const s = novoServidor();
    const c = await celular(s);
    const l = await c.banco.adicionarLancamento(dizimo());
    await c.banco.sincronizar();
    c.remoto.falharProxima('excluirLancamento', 'permissao', { mensagem: 'Sem permissão.' });
    await c.banco.excluirLancamento(l.id);
    await c.banco.sincronizar();
    expect(c.estado().lancamentos[l.id]).toBeDefined();
    expect(c.estado().rejeitadas[0].rotulo).toMatch(/^Exclusão de Dízimo de Silvana/);
  });

  test('erro desconhecido: tenta algumas vezes antes de desistir', async () => {
    const s = novoServidor();
    const c = await celular(s);
    for (let i = 0; i < 4; i++) c.remoto.falharProxima('gravarLancamento', 'outro', { mensagem: 'Erro 500' });
    await c.banco.adicionarLancamento(despesa('Teimoso', 100));
    for (let i = 0; i < 3; i++) {
      await c.banco.sincronizar();
      expect(c.estado().fila).toHaveLength(1);
      expect(c.estado().rejeitadas).toHaveLength(0);
    }
    await c.banco.sincronizar();
    expect(c.estado().fila).toHaveLength(0);
    expect(c.estado().rejeitadas).toHaveLength(1);
  });

  test('leitor não consegue lançar nem excluir', async () => {
    const s = novoServidor();
    const dono = await celular(s, DONO);
    const l = await dono.banco.adicionarLancamento(dizimo());
    await dono.banco.sincronizar();
    const leitor = await celular(s, LEITOR);
    expect(Object.keys(leitor.estado().lancamentos)).toHaveLength(1);
    await expect(leitor.banco.adicionarLancamento(dizimo())).rejects.toThrow(/só pode consultar/);
    await expect(leitor.banco.excluirLancamento(l.id)).rejects.toThrow(/só pode consultar/);
  });

  test('conta fora da lista: não recebe nenhum dado', async () => {
    const s = novoServidor();
    const dono = await celular(s, DONO);
    await dono.banco.adicionarLancamento(dizimo());
    await dono.banco.sincronizar();
    const intruso = await celular(s, 'intruso@gmail.com');
    expect(intruso.estado()).toMatchObject({ usuario: null, autorizacaoConhecida: true, lancamentos: {}, membros: {} });
  });

  test('sessão expirada: avisa e mantém a fila', async () => {
    const s = novoServidor();
    const c = await celular(s);
    await c.banco.adicionarLancamento(dizimo());
    c.remoto.falharProxima('*', 'sessao');
    await c.banco.sincronizar();
    expect(c.estado().sinc.erro).toMatch(/sessão expirou/);
    expect(c.estado().fila.length + validos(s).length).toBeGreaterThan(0);
  });
});

describe('fotos de comprovante', () => {
  test('envia depois do lançamento e apaga a cópia local', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.online = false;
    const l = await c.banco.adicionarLancamento(despesa('Mercado', 5000), { comprovanteUri: 'file:///cupom.jpg' });
    expect(l.comprovante).toMatch(/^2026\/11\/.+\.jpg$/);
    expect(c.estado().lancamentos[l.id].comprovanteLocal).toBe('file:///cupom.jpg');
    c.remoto.online = true;
    await c.banco.sincronizar();
    expect(s.comprovantes.get(l.comprovante!)).toBe('file:///cupom.jpg');
    expect(s.lancamentos.get(l.id)!.comprovante).toBe(l.comprovante);
    expect(c.estado().lancamentos[l.id].comprovanteLocal).toBeFalsy();
    expect(c.estado().lancamentos[l.id].pendente).toBeFalsy();
    expect(c.removidos).toEqual(['file:///cupom.jpg']);
  });

  test('se o envio da foto falhar por falta de internet, o lançamento já está salvo', async () => {
    const s = novoServidor();
    const c = await celular(s);
    c.remoto.falharProxima('enviarComprovante', 'rede');
    const l = await c.banco.adicionarLancamento(despesa('Mercado', 5000), { comprovanteUri: 'file:///cupom.jpg' });
    await c.banco.sincronizar();
    expect(validos(s)).toHaveLength(1);
    expect(c.estado().fila.map((o) => o.op)).toEqual(['comprovante.enviar']);
    await c.banco.sincronizar();
    expect(s.comprovantes.size).toBe(1);
    expect(c.estado().lancamentos[l.id].comprovanteLocal).toBeFalsy();
  });
});

describe('configurações e troca de conta', () => {
  test('recebe saldo de abertura, responsável padrão e lista de responsáveis', async () => {
    const s = novoServidor();
    s.config.set('saldo_abertura_centavos', 150000);
    s.responsaveis[1].ativo = false;
    const c = await celular(s);
    expect(c.estado().config).toEqual({ saldoAberturaCentavos: 150000, responsavelPadrao: 'Alex' });
    expect(c.estado().responsaveis.map((r) => [r.nome, r.ativo])).toEqual([['Alex', true], ['Júlio', false], ['Lázaro', true]]);
  });

  test('outra conta no mesmo aparelho começa do zero', async () => {
    const s = novoServidor();
    const arm = armazenamentoMemoria();
    const dono = await celular(s, DONO, arm);
    await dono.banco.adicionarLancamento(dizimo());
    await dono.banco.sincronizar();
    await dono.banco.aguardarDisco();
    s.usuarios = s.usuarios.filter((u) => u.email !== TES); // tesoureiro foi removido da lista
    const outro = await celular(s, TES, arm);
    expect(outro.estado()).toMatchObject({ dono: TES, usuario: null, lancamentos: {} });
    await outro.banco.aguardarDisco();
    expect(Object.keys(arm.dados).filter((k) => k.startsWith('adrer1:l:'))).toEqual([]);
  });

  test('recarregar tudo remove do celular o que não existe mais no servidor', async () => {
    const s = novoServidor();
    const c = await celular(s);
    const l = await c.banco.adicionarLancamento(dizimo());
    await c.banco.sincronizar();
    s.lancamentos.delete(l.id); // apagado direto no banco
    await c.banco.sincronizar();
    expect(c.estado().lancamentos[l.id]).toBeDefined(); // sincronização normal não percebe
    await c.banco.recarregarTudo();
    expect(c.estado().lancamentos[l.id]).toBeUndefined();
  });

  test('sair apaga tudo do aparelho', async () => {
    const s = novoServidor();
    const arm = armazenamentoMemoria();
    const c = await celular(s, DONO, arm);
    await c.banco.adicionarLancamento(dizimo());
    await c.banco.sincronizar();
    await c.banco.limparTudo();
    expect(Object.keys(arm.dados)).toEqual([]);
    expect(c.estado().carregado).toBe(false);
  });
});

test('RemotoMemoria é do tipo certo', () => {
  expect(novoServidor().conectar(DONO)).toBeInstanceOf(RemotoMemoria);
});
