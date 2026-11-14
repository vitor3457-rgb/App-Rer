/**
 * Integração com o Supabase de verdade.
 * Cria duas contas de teste temporárias (uma autorizada, uma intrusa), exercita o app
 * de ponta a ponta (remoto + banco local) e APAGA tudo o que criou no final.
 */
import { randomBytes, randomUUID } from 'node:crypto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from '@/config';
import { DadosValidados } from '@/core/validacao';
import { armazenamentoMemoria } from '@/dados/armazenamento';
import { criarBanco } from '@/dados/banco';
import { ErroRemoto, LancamentoEnvio, Remoto } from '@/dados/remoto';
import { criarRemotoSupabase } from '@/dados/remotoSupabase';

const PROJETO = 'nkkqbqvhuumtlywlstws';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'proxy-injected';
const SUFIXO = randomBytes(4).toString('hex');
const EMAIL_TES = `teste-tesoureiro-${SUFIXO}@teste.adrer.app`;
const EMAIL_INTRUSO = `teste-intruso-${SUFIXO}@teste.adrer.app`;
const SENHA = randomBytes(18).toString('base64url');
const FOTO = 'teste-integracao/' + SUFIXO + '.jpg';

async function sql(consulta: string): Promise<any[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJETO}/database/query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: consulta }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error('SQL falhou: ' + texto.slice(0, 400));
  return texto ? JSON.parse(texto) : [];
}

async function criarConta(email: string): Promise<string> {
  const id = randomUUID();
  await sql(`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${email}',
      extensions.crypt('${SENHA}', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), '${id}', '${id}',
      jsonb_build_object('sub', '${id}', 'email', '${email}', 'email_verified', true), 'email', now(), now(), now());
  `);
  return id;
}

function cliente(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function conectar(email: string, tamanhoPagina = 500): Promise<{ supabase: SupabaseClient; remoto: Remoto }> {
  const supabase = cliente();
  const { error } = await supabase.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error('Login de teste falhou: ' + error.message);
  const remoto = criarRemotoSupabase(supabase, {
    tamanhoPagina,
    lerArquivo: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]).buffer as ArrayBuffer,
  });
  return { supabase, remoto };
}

function envio(extra: Partial<LancamentoEnvio> = {}): LancamentoEnvio {
  return {
    id: randomUUID(), dataReferencia: '2026-11-08', tipo: 'Entrada', categoria: 'Oferta', descricao: '',
    membroId: null, valorCentavos: 1234, responsavel: 'Alex', comprovante: null, criadoEm: new Date().toISOString(),
    ...extra,
  };
}

async function tipoDoErro(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'sem erro';
  } catch (e) {
    return e instanceof ErroRemoto ? e.tipo : 'erro inesperado: ' + String(e);
  }
}

let tes: { supabase: SupabaseClient; remoto: Remoto };
let intruso: { supabase: SupabaseClient; remoto: Remoto };
const idsContas: string[] = [];

beforeAll(async () => {
  idsContas.push(await criarConta(EMAIL_TES), await criarConta(EMAIL_INTRUSO));
  await sql(`insert into public.usuarios (email, nome, papel) values ('${EMAIL_TES}', 'Teste automático', 'tesoureiro')`);
  tes = await conectar(EMAIL_TES, 2); // páginas de 2 linhas para exercitar a paginação
  intruso = await conectar(EMAIL_INTRUSO);
});

afterAll(async () => {
  try {
    await tes?.supabase.storage.from('comprovantes').remove([FOTO]);
  } catch { /* segue a limpeza */ }
  await sql(`
    delete from public.lancamentos where usuario_email in ('${EMAIL_TES}', '${EMAIL_INTRUSO}');
    delete from public.membros where observacao = 'teste-${SUFIXO}' or nome like '%${SUFIXO}%';
    delete from public.usuarios where email in ('${EMAIL_TES}', '${EMAIL_INTRUSO}');
    delete from auth.users where email in ('${EMAIL_TES}', '${EMAIL_INTRUSO}');
  `);
});

describe('conta autorizada (tesoureiro)', () => {
  test('é reconhecida e recebe responsáveis e configurações', async () => {
    expect(await tes.remoto.meuUsuario()).toMatchObject({ email: EMAIL_TES, papel: 'tesoureiro', ativo: true });
    expect((await tes.remoto.responsaveis()).map((r) => r.nome)).toEqual(expect.arrayContaining(['Alex', 'Júlio', 'Lázaro']));
    const config = await tes.remoto.configuracoes();
    expect(config.find((c) => c.chave === 'saldo_abertura_centavos')).toBeDefined();
  });

  test('grava, reenvia sem duplicar, baixa em páginas e exclui', async () => {
    const membroId = randomUUID();
    await tes.remoto.gravarMembro({ id: membroId, nome: 'Silvana ' + SUFIXO, telefone: '', observacao: 'teste-' + SUFIXO, ativo: true });
    const itens = [
      envio({ categoria: 'Dízimo', descricao: 'Silvana ' + SUFIXO, membroId, valorCentavos: 5000 }),
      envio({ valorCentavos: 10 }),
      envio({ tipo: 'Saída', categoria: 'Despesa', descricao: '  Conta   de luz ', valorCentavos: 12735 }),
      envio({ valorCentavos: 20 }),
      envio({ valorCentavos: 30 }),
    ];
    for (const l of itens) await tes.remoto.gravarLancamento(l);
    await tes.remoto.gravarLancamento({ ...itens[1], valorCentavos: 11 }); // mesmo ID: atualiza, não duplica

    const meus = (await tes.remoto.lancamentosAlterados(null)).filter((l) => l.usuarioEmail === EMAIL_TES);
    expect(meus).toHaveLength(5);
    const porId = new Map(meus.map((l) => [l.id, l]));
    expect(porId.get(itens[0].id)).toMatchObject({ categoria: 'Dízimo', membroId, valorCentavos: 5000, dataReferencia: '2026-11-08', excluidoEm: null });
    expect(porId.get(itens[1].id)!.valorCentavos).toBe(11);
    expect(porId.get(itens[2].id)!.descricao).toBe('Conta de luz');
    expect(typeof porId.get(itens[0].id)!.atualizadoEm).toBe('string');

    // baixar só o que mudou depois de um instante
    const corte = meus.map((l) => l.atualizadoEm).sort()[2];
    const depois = (await tes.remoto.lancamentosAlterados(corte)).filter((l) => l.usuarioEmail === EMAIL_TES);
    expect(depois.length).toBeLessThan(5);
    expect(depois.every((l) => Date.parse(l.atualizadoEm) > Date.parse(corte) - 1)).toBe(true);

    await tes.remoto.excluirLancamento(itens[4].id);
    await tes.remoto.excluirLancamento(itens[4].id); // repetir não dá erro
    const excluido = (await tes.remoto.lancamentosAlterados(null)).find((l) => l.id === itens[4].id)!;
    expect(excluido.excluidoPor).toBe(EMAIL_TES);
    expect(excluido.excluidoEm).not.toBeNull();

    // renomear o membro muda a descrição do dízimo ligado a ele
    await tes.remoto.gravarMembro({ id: membroId, nome: 'Silvana Souza ' + SUFIXO, telefone: '11', observacao: 'teste-' + SUFIXO, ativo: true });
    const renomeado = (await tes.remoto.lancamentosAlterados(null)).find((l) => l.id === itens[0].id)!;
    expect(renomeado.descricao).toBe('Silvana Souza ' + SUFIXO);
    const membros = await tes.remoto.membrosAlterados(null);
    expect(membros.find((m) => m.id === membroId)).toMatchObject({ nome: 'Silvana Souza ' + SUFIXO, telefone: '11' });
  });

  test('erros do servidor chegam traduzidos', async () => {
    expect(await tipoDoErro(tes.remoto.gravarLancamento(envio({ valorCentavos: 0 })))).toBe('validacao');
    expect(await tipoDoErro(tes.remoto.gravarLancamento(envio({ categoria: 'Dízimo', descricao: '' })))).toBe('validacao');
    expect(await tipoDoErro(tes.remoto.gravarLancamento(envio({ membroId: randomUUID(), categoria: 'Dízimo', descricao: 'x' })))).toBe('validacao');
    expect(await tipoDoErro(tes.remoto.gravarUsuario({ email: 'novo@gmail.com', nome: '', papel: 'admin', ativo: true }))).toBe('permissao');
    expect(await tipoDoErro(tes.remoto.gravarResponsavel({ nome: 'Pedro ' + SUFIXO, ativo: true, ordem: 9 }))).toBe('permissao');
    expect(await tipoDoErro(tes.remoto.gravarConfiguracao('saldo_abertura_centavos', 999))).toBe('permissao');
    const saldo = (await tes.remoto.configuracoes()).find((c) => c.chave === 'saldo_abertura_centavos')!.valor;
    expect(saldo).not.toBe(999);
    await expect(tes.remoto.gravarLancamento(envio({ valorCentavos: 0 }))).rejects.toThrow(/Valor inválido/);
  });

  test('tesoureiro vê só a própria linha na lista de usuários', async () => {
    expect((await tes.remoto.listarUsuarios()).map((u) => u.email)).toEqual([EMAIL_TES]);
  });

  test('foto do comprovante: envia e gera endereço temporário', async () => {
    await tes.remoto.enviarComprovante(FOTO, 'file:///qualquer.jpg');
    await tes.remoto.enviarComprovante(FOTO, 'file:///qualquer.jpg'); // repetir substitui
    const url = await tes.remoto.urlComprovante(FOTO);
    const resposta = await fetch(url);
    expect(resposta.status).toBe(200);
    expect((await resposta.arrayBuffer()).byteLength).toBe(14);
    expect(await tipoDoErro(tes.remoto.urlComprovante('teste-integracao/nao-existe.jpg'))).toBe('outro');
  });

  test('ponta a ponta: banco local → fila → Supabase → outro celular', async () => {
    let n = 0;
    const novoBanco = async () => {
      const b = criarBanco({ remoto: tes.remoto, armazenamento: armazenamentoMemoria(), novoId: () => randomUUID(), enviarAoGravar: false });
      await b.carregar(EMAIL_TES);
      await b.sincronizar();
      n++;
      return b;
    };
    const a = await novoBanco();
    const b = await novoBanco();
    expect(a.loja.getState().usuario?.papel).toBe('tesoureiro');
    expect(a.loja.getState().sinc.erro).toBeNull();

    const dados: DadosValidados = { responsavel: 'Alex', valorCentavos: 7700, tipo: 'Entrada', categoria: 'Dízimo', descricao: 'Fulano ' + SUFIXO, dataReferencia: '2026-11-09' };
    const l = await a.adicionarLancamento(dados);
    await a.sincronizar();
    expect(a.loja.getState().fila).toEqual([]);
    expect(a.loja.getState().rejeitadas).toEqual([]);
    expect(a.loja.getState().lancamentos[l.id].pendente).toBeFalsy();

    await b.sincronizar();
    expect(b.loja.getState().lancamentos[l.id]).toMatchObject({ valorCentavos: 7700, descricao: 'Fulano ' + SUFIXO, usuarioEmail: EMAIL_TES });
    expect(Object.values(b.loja.getState().membros).some((m) => m.nome === 'Fulano ' + SUFIXO)).toBe(true);

    await b.excluirLancamento(l.id);
    await b.sincronizar();
    await a.sincronizar();
    expect(a.loja.getState().lancamentos[l.id]).toBeUndefined();
    expect(n).toBe(2);
  });
});

describe('conta fora da lista (intruso)', () => {
  test('não é reconhecida, não lê e não grava', async () => {
    expect(await intruso.remoto.meuUsuario()).toBeNull();
    expect(await intruso.remoto.lancamentosAlterados(null)).toEqual([]);
    expect(await intruso.remoto.membrosAlterados(null)).toEqual([]);
    expect(await intruso.remoto.responsaveis()).toEqual([]);
    expect(await intruso.remoto.configuracoes()).toEqual([]);
    expect(await intruso.remoto.listarUsuarios()).toEqual([]);
    expect(await tipoDoErro(intruso.remoto.gravarLancamento(envio()))).toBe('permissao');
    expect(await tipoDoErro(intruso.remoto.enviarComprovante('teste-integracao/intruso.jpg', 'x'))).toBe('permissao');
    expect(await tipoDoErro(intruso.remoto.urlComprovante(FOTO))).toBe('outro');
  });

  test('sem login: erro de sessão', async () => {
    const semLogin = criarRemotoSupabase(cliente(), { lerArquivo: async () => new ArrayBuffer(0) });
    expect(await tipoDoErro(semLogin.meuUsuario())).toBe('sessao');
  });
});
