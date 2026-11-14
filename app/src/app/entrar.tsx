import { Redirect } from 'expo-router';

import { useBanco, useSessao } from '@/dados/hooks';

/**
 * Ponto de passagem: é o endereço de retorno do login do Google (adrer://entrar) e também
 * para onde a navegação cai quando a situação da conta muda. Daqui a pessoa segue para a
 * tela certa: login, "sem acesso" ou o app.
 */
export default function Passagem() {
  const fase = useSessao((e) => e.fase);
  const usuario = useBanco((e) => e.usuario);
  if (fase !== 'dentro') return <Redirect href="/login" />;
  if (!usuario) return <Redirect href="/sem-acesso" />;
  return <Redirect href="/" />;
}
