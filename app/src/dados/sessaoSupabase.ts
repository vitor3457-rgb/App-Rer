import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { Autenticacao, Conta } from './sessao';
import { supabase } from './supabase';

/** Login com Google pelo Supabase Auth. */

WebBrowser.maybeCompleteAuthSession();

/** Para onde o Google devolve a pessoa depois do login (precisa estar liberado no Supabase). */
export const URL_RETORNO = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.location.origin : '')
  : Linking.createURL('entrar');

function paraConta(sessao: Session | null): Conta | null {
  const u = sessao?.user;
  if (!u?.email) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    email: u.email.toLowerCase(),
    nome: String(meta.full_name ?? meta.name ?? '') || u.email.split('@')[0],
    foto: typeof meta.avatar_url === 'string' ? meta.avatar_url : null,
  };
}

const codigosUsados = new Set<string>();

/** Lê o endereço de retorno do login e cria a sessão. */
export async function criarSessaoDaUrl(url: string): Promise<boolean> {
  const depoisDe = (sep: string) => {
    const i = url.indexOf(sep);
    if (i < 0) return '';
    let resto = url.slice(i + 1);
    const fim = sep === '?' ? resto.indexOf('#') : -1;
    if (fim >= 0) resto = resto.slice(0, fim);
    return resto;
  };
  const params = new URLSearchParams(depoisDe('?'));
  new URLSearchParams(depoisDe('#')).forEach((valor, chave) => params.set(chave, valor));

  const erro = params.get('error_description') || params.get('error');
  if (erro) throw new Error(erro.replace(/\+/g, ' '));

  const codigo = params.get('code');
  if (codigo) {
    if (codigosUsados.has(codigo)) return true;
    codigosUsados.add(codigo);
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) throw new Error(error.message);
    return true;
  }
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (access && refresh) {
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw new Error(error.message);
    return true;
  }
  return false;
}

export const autenticacaoSupabase: Autenticacao = {
  async contaAtual() {
    const { data } = await supabase.auth.getSession();
    return paraConta(data.session);
  },

  async entrarComGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: URL_RETORNO,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' }, // sempre deixa escolher a conta
      },
    });
    if (error || !data?.url) throw new Error(error?.message ?? 'Não foi possível abrir o login do Google.');

    if (Platform.OS === 'web') {
      window.location.assign(data.url);
      return false;
    }
    const resultado = await WebBrowser.openAuthSessionAsync(data.url, URL_RETORNO);
    if (resultado.type !== 'success' || !resultado.url) return false;
    return criarSessaoDaUrl(resultado.url);
  },

  async sair() {
    await supabase.auth.signOut({ scope: 'local' });
  },

  aoMudar(ouvinte) {
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      // Fora do retorno de chamada do Supabase, para evitar travas internas dele.
      setTimeout(() => ouvinte(paraConta(sessao)), 0);
    });
    // Em alguns aparelhos o retorno do login chega como link, e não pela janela do navegador.
    const link = Platform.OS === 'web' ? null : Linking.addEventListener('url', ({ url }) => {
      if (url.includes('code=') || url.includes('access_token=') || url.includes('error')) {
        criarSessaoDaUrl(url).catch(() => {});
      }
    });
    return () => {
      data.subscription.unsubscribe();
      link?.remove();
    };
  },
};
