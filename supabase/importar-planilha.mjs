// Importa os lançamentos da planilha antiga (app do Google Apps Script) para o Supabase.
// - Lê a aba "Lancamentos" pela API do Google, com o login do clasp (~/.clasprc.json).
// - Mostra um resumo e NÃO grava nada, a menos que seja chamado com --aplicar.
// - Pode rodar mais de uma vez: quem já foi importado (mesmo ID) é ignorado.
// Rodar: NODE_USE_ENV_PROXY=1 node supabase/importar-planilha.mjs [--aplicar]
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sql } from './api.mjs';

const PLANILHA = '1sYPLI4UyaGCvtKJIwI_OhJ3f08QFN0zPADB3qFVQIEg';
const APLICAR = process.argv.includes('--aplicar');
const FUSO_HORAS = 3; // São Paulo = UTC-3 (sem horário de verão)

async function tokenGoogle() {
  const t = JSON.parse(readFileSync(join(homedir(), '.clasprc.json'), 'utf8')).tokens.default;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Login do clasp expirado. Refaça o "clasp login". (' + (d.error_description || d.error) + ')');
  return d.access_token;
}

async function lerPlanilha() {
  // A planilha é baixada inteira em formato Excel (API do Drive) e lida aqui mesmo.
  const token = await tokenGoogle();
  const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${PLANILHA}/export?mimeType=${encodeURIComponent(tipo)}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!r.ok) throw new Error('Não consegui baixar a planilha: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const XLSX = createRequire(import.meta.url)('../app/node_modules/xlsx');
  const livro = XLSX.read(Buffer.from(await r.arrayBuffer()), { type: 'buffer' });
  console.log('Abas da planilha: ' + livro.SheetNames.join(', '));
  const aba = livro.Sheets.Lancamentos;
  if (!aba) return []; // nenhum lançamento foi feito no app antigo
  return XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: '' });
}

const dois = (n) => String(n).padStart(2, '0');
function dataDeSerial(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return d.getUTCFullYear() + '-' + dois(d.getUTCMonth() + 1) + '-' + dois(d.getUTCDate());
}
function instanteDeSerial(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000) + FUSO_HORAS * 3600000).toISOString();
}
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const q = (t) => (t === null || t === undefined ? 'null' : "'" + String(t).replace(/'/g, "''") + "'");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linhas = await lerPlanilha();
const dados = linhas.slice(1).filter((l) => l.some((c) => c !== '' && c !== undefined));
const lancamentos = [];
const problemas = [];
for (const [i, l] of dados.entries()) {
  const [id, dataHora, dataRef, , , tipoBruto, catBruta, descricao, valor, usuario, responsavel] = l;
  const tipo = semAcento(tipoBruto) === 'entrada' ? 'Entrada' : semAcento(tipoBruto) === 'saida' ? 'Saída' : null;
  const cat = { dizimo: 'Dízimo', oferta: 'Oferta', despesa: 'Despesa' }[semAcento(catBruta)] ?? null;
  const centavos = typeof valor === 'number' ? Math.round(valor * 100) : NaN;
  const data = typeof dataRef === 'number' ? dataDeSerial(dataRef) : null;
  const desc = String(descricao ?? '').replace(/\s+/g, ' ').trim();
  const motivo = !tipo ? 'tipo inválido' : !cat ? 'categoria inválida' : !(centavos > 0) ? 'valor inválido' : !data ? 'data inválida'
    : (tipo === 'Entrada') !== (cat !== 'Despesa') ? 'tipo e categoria não combinam' : null;
  if (motivo) {
    problemas.push(`linha ${i + 2}: ${motivo} — ${JSON.stringify(l).slice(0, 120)}`);
    continue;
  }
  lancamentos.push({
    id: UUID.test(String(id)) ? String(id).toLowerCase() : randomUUID(),
    criadoEm: typeof dataHora === 'number' ? instanteDeSerial(dataHora) : new Date().toISOString(),
    data, tipo, cat,
    // No app antigo o dízimo podia ficar sem nome; o novo exige um texto.
    desc: desc || (cat === 'Dízimo' ? 'Não informado' : cat === 'Despesa' ? 'Sem descrição' : ''),
    centavos,
    usuario: String(usuario ?? '').trim().toLowerCase(),
    responsavel: String(responsavel ?? '').trim() || 'Não informado',
  });
}

const soma = (f) => lancamentos.filter(f).reduce((s, l) => s + l.centavos, 0) / 100;
console.log(`Planilha: ${dados.length} linha(s) com dados · ${lancamentos.length} válida(s) · ${problemas.length} com problema`);
console.log(`Entradas: R$ ${soma((l) => l.tipo === 'Entrada').toFixed(2)} · Saídas: R$ ${soma((l) => l.tipo === 'Saída').toFixed(2)}`);
for (const l of lancamentos) console.log(`  ${l.data}  ${l.tipo.padEnd(7)} ${l.cat.padEnd(7)} ${String((l.centavos / 100).toFixed(2)).padStart(10)}  ${l.desc || '-'}  [${l.responsavel}]`);
for (const p of problemas) console.log('  ⚠ ' + p);

if (!APLICAR) {
  console.log('\nNada foi gravado. Para importar de verdade: acrescente --aplicar');
  process.exit(0);
}
if (!lancamentos.length) {
  console.log('\nNada para importar.');
  process.exit(0);
}

// Quem contribuiu vira cadastro de membro (reaproveitando os que já existem, sem diferenciar acento/maiúscula).
const existentes = await sql('select id, nome from public.membros where excluido_em is null');
const membros = new Map(existentes.map((m) => [semAcento(m.nome), m.id]));
const novosMembros = [];
for (const l of lancamentos) {
  l.membroId = null;
  if (l.tipo !== 'Entrada' || !l.desc || l.desc === 'Não informado') continue;
  const chave = semAcento(l.desc);
  if (!membros.has(chave)) {
    const id = randomUUID();
    membros.set(chave, id);
    novosMembros.push({ id, nome: l.desc });
  }
  l.membroId = membros.get(chave);
}

const antes = (await sql('select count(*)::int as n from public.lancamentos'))[0].n;
await sql(`begin;
${novosMembros.length ? `insert into public.membros (id, nome) values ${novosMembros.map((m) => `(${q(m.id)}, ${q(m.nome)})`).join(',\n')};` : ''}
insert into public.lancamentos (id, data_referencia, tipo, categoria, descricao, membro_id, valor_centavos, responsavel, usuario_email, criado_em) values
${lancamentos.map((l) => `(${q(l.id)}, ${q(l.data)}, ${q(l.tipo)}, ${q(l.cat)}, ${q(l.desc)}, ${q(l.membroId)}, ${l.centavos}, ${q(l.responsavel)}, ${q(l.usuario)}, ${q(l.criadoEm)})`).join(',\n')}
on conflict (id) do nothing;
commit;`);
const depois = (await sql('select count(*)::int as n from public.lancamentos'))[0].n;
console.log(`\nImportação concluída: ${depois - antes} lançamento(s) novo(s) no banco (${lancamentos.length - (depois - antes)} já existia(m)); ${novosMembros.length} cadastro(s) de membro criado(s).`);
