// Ajusta o login do projeto no Supabase (endereços de retorno do app).
// O provedor Google (ID e segredo do cliente OAuth) é ligado pelo dono no painel do Supabase:
//   Authentication → Sign In / Providers → Google.
// Rodar: NODE_USE_ENV_PROXY=1 node supabase/configurar-login.mjs
import { api } from './api.mjs';

const desejado = {
  site_url: 'adrer://entrar',
  uri_allow_list: 'adrer://entrar,adrer://**',
};
const r = await api('/config/auth', { method: 'PATCH', body: desejado });
if (!r.ok) {
  console.error('Falhou:', r.status, JSON.stringify(r.dados).slice(0, 400));
  process.exit(1);
}
const d = r.dados;
console.log('Endereço padrão de retorno:', d.site_url);
console.log('Endereços de retorno aceitos:', d.uri_allow_list);
console.log('Login com Google ligado:', d.external_google_enabled);
console.log('Login por e-mail/senha ligado:', d.external_email_enabled, '(desligar antes da entrega final)');
console.log('Confirmação de e-mail exigida:', !d.mailer_autoconfirm);
