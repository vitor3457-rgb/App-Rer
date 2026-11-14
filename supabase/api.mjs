// Acesso à Management API do Supabase (para rodar SQL no banco do projeto).
// O token NÃO fica aqui: o proxy do ambiente de nuvem troca o cabeçalho pelo token real.
// Fora desse ambiente: defina SUPABASE_ACCESS_TOKEN com um token pessoal (sbp_...).
// Rodar sempre com NODE_USE_ENV_PROXY=1 (os scripts do package.json já fazem isso).
export const PROJETO = 'nkkqbqvhuumtlywlstws';
const BASE = 'https://api.supabase.com/v1/projects/' + PROJETO;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'proxy-injected';

export async function api(caminho, opcoes = {}) {
  const resposta = await fetch(BASE + caminho, {
    method: opcoes.method || 'GET',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
  });
  const texto = await resposta.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
  return { ok: resposta.ok, status: resposta.status, dados };
}

/** Roda SQL e devolve as linhas do último comando. Lança erro com a mensagem do Postgres. */
export async function sql(consulta) {
  const r = await api('/database/query', { method: 'POST', body: { query: consulta } });
  if (!r.ok) {
    const msg = r.dados && r.dados.message ? r.dados.message : JSON.stringify(r.dados);
    const erro = new Error(msg);
    erro.status = r.status;
    throw erro;
  }
  return r.dados;
}
