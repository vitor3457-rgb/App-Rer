import { createStore } from 'zustand/vanilla';

import { MODO_DEMO } from '@/config';

import { Armazenamento, armazenamentoMemoria } from './armazenamento';
import { criarBanco } from './banco';
import { armazenamentoAparelho, lerArquivo, novoId, removerArquivo } from './plataforma';
import { Remoto } from './remoto';
import { Autenticacao, Conta } from './sessao';

/**
 * Ponto central dos dados do app: escolhe entre o servidor de verdade (Supabase)
 * e o modo demonstração, cria o banco local e cuida do login.
 */

let remoto: Remoto;
let autenticacao: Autenticacao;
let armazenamento: Armazenamento;

if (MODO_DEMO) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const demo = require('./demo').criarDemo();
  remoto = demo.remoto;
  autenticacao = demo.autenticacao;
  armazenamento = armazenamentoMemoria();
  (globalThis as any).__ADRER_DEMO__ = demo; // os testes usam para simular "sem internet"
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { supabase } = require('./supabase');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  remoto = require('./remotoSupabase').criarRemotoSupabase(supabase, { lerArquivo });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  autenticacao = require('./sessaoSupabase').autenticacaoSupabase;
  armazenamento = armazenamentoAparelho;
}

export const banco = criarBanco({ remoto, armazenamento, novoId, removerArquivo });
if (MODO_DEMO) (globalThis as any).__ADRER_DEMO__.banco = banco;

// ---------------------------------------------------------------- sessão

export interface EstadoSessao {
  fase: 'iniciando' | 'fora' | 'dentro';
  conta: Conta | null;
  entrando: boolean;
  erro: string | null;
}

export const sessao = createStore<EstadoSessao>(() => ({ fase: 'iniciando', conta: null, entrando: false, erro: null }));

let contaCarregada: string | null = null;
let trocando: Promise<void> = Promise.resolve();

/** Reage a qualquer mudança de conta (uma de cada vez, em ordem). */
function aoMudarConta(conta: Conta | null): Promise<void> {
  trocando = trocando.then(async () => {
    if (conta) {
      if (contaCarregada !== conta.email) {
        await banco.carregar(conta.email);
        contaCarregada = conta.email;
      }
      sessao.setState({ fase: 'dentro', conta, entrando: false, erro: null });
      void banco.sincronizar();
    } else {
      if (contaCarregada) {
        await banco.limparTudo();
        contaCarregada = null;
      }
      sessao.setState({ fase: 'fora', conta: null, entrando: false });
    }
  }).catch((e) => {
    sessao.setState({ fase: 'fora', conta: null, entrando: false, erro: e instanceof Error ? e.message : String(e) });
  });
  return trocando;
}

let iniciado = false;

/** Chamado uma vez quando o app abre. */
export async function iniciarDados(): Promise<void> {
  if (iniciado) return;
  iniciado = true;
  autenticacao.aoMudar((conta) => void aoMudarConta(conta));
  let conta: Conta | null = null;
  try {
    conta = await autenticacao.contaAtual();
  } catch {
    conta = null;
  }
  await aoMudarConta(conta);
}

export async function entrar(): Promise<void> {
  sessao.setState({ entrando: true, erro: null });
  try {
    const ok = await autenticacao.entrarComGoogle();
    if (ok) await aoMudarConta(await autenticacao.contaAtual());
    else sessao.setState({ entrando: false });
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : String(e);
    sessao.setState({ entrando: false, erro: 'Não foi possível entrar. Verifique a internet e tente de novo. (Detalhe: ' + detalhe + ')' });
  }
}

/** Sai da conta. Devolve quantos itens ainda não enviados seriam perdidos se `forcar` for falso. */
export async function sair(forcar = false): Promise<number> {
  const pendentes = banco.loja.getState().fila.length;
  if (pendentes && !forcar) return pendentes;
  await autenticacao.sair();
  await aoMudarConta(null);
  return 0;
}

export { remoto };
