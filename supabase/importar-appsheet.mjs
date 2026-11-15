// Importa o banco de dados do app antigo feito no AppSheet (arquivo .xlsx exportado por lá).
// Abas usadas: "Movimentações", "Membros" e "Responsavel".
// - Sem --aplicar: só mostra o resumo, não grava nada.
// - Com --aplicar: marca como excluído tudo o que existe hoje no banco (eram testes) e grava os
//   dados do AppSheet. Pode rodar de novo: os IDs são derivados dos IDs do AppSheet, então não duplica.
// O arquivo tem nomes de pessoas: NÃO deve ser colocado no repositório.
// Rodar: NODE_USE_ENV_PROXY=1 node supabase/importar-appsheet.mjs <arquivo.xlsx> [--aplicar]
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { sql } from './api.mjs';

const arquivo = process.argv[2];
const APLICAR = process.argv.includes('--aplicar');
if (!arquivo || arquivo.startsWith('--')) {
  console.error('Informe o caminho do arquivo .xlsx exportado do AppSheet.');
  process.exit(1);
}
const XLSX = createRequire(import.meta.url)('../app/node_modules/xlsx');
const livro = XLSX.readFile(arquivo);
const aba = (nome) => XLSX.utils.sheet_to_json(livro.Sheets[nome], { header: 1, raw: true, defval: null })
  .slice(1).filter((l) => l.some((c) => c !== null && c !== ''));

/** UUID fixo a partir do ID do AppSheet (mesmo ID de origem → mesmo UUID, sempre). */
function uuidDe(tipo, id) {
  const h = createHash('sha1').update('adrer-appsheet:' + tipo + ':' + id).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const dois = (n) => String(n).padStart(2, '0');
function dataDeSerial(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return d.getUTCFullYear() + '-' + dois(d.getUTCMonth() + 1) + '-' + dois(d.getUTCDate());
}
const limpar = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const semAcento = (t) => limpar(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const q = (t) => (t === null || t === undefined ? 'null' : "'" + String(t).replace(/'/g, "''") + "'");

// ---- responsáveis: usa a grafia que já existe no app novo (ex.: "Julio" → "Júlio")
const responsaveisNovos = await sql('select nome from public.responsaveis');
const responsaveis = new Map(aba('Responsavel').map(([id, nome]) => {
  const igual = responsaveisNovos.find((r) => semAcento(r.nome) === semAcento(nome));
  return [String(Math.round(Number(id))), igual ? igual.nome : limpar(nome)];
}));

// ---- membros
const membros = aba('Membros').map(([id, nome]) => ({ origem: String(id), id: uuidDe('membro', id), nome: limpar(nome) }));
const membroPorOrigem = new Map(membros.map((m) => [m.origem, m]));

// ---- movimentações
const lancamentos = [];
const problemas = [];
for (const [i, l] of aba('Movimentações').entries()) {
  const [idOrigem, tipoBruto, , valor, forma, resp, dataSerial, descricao, membroOrigem] = l;
  const tipo = semAcento(tipoBruto) === 'entrada' ? 'Entrada' : semAcento(tipoBruto) === 'saida' ? 'Saída' : null;
  const categoriaBruta = semAcento(l[2]);
  const categoria = tipo === 'Saída' ? 'Despesa' : { dizimo: 'Dízimo', oferta: 'Oferta' }[categoriaBruta] ?? null;
  const centavos = typeof valor === 'number' ? Math.round(valor * 100) : NaN;
  const data = typeof dataSerial === 'number' ? dataDeSerial(dataSerial) : null;
  const membro = membroOrigem ? membroPorOrigem.get(String(membroOrigem)) : null;
  const responsavel = responsaveis.get(String(resp).replace(/\.0$/, ''));
  const texto = limpar(descricao);
  const motivo = !tipo ? 'tipo inválido' : !categoria ? 'categoria inválida' : !(centavos > 0) ? 'valor inválido'
    : !data ? 'data inválida' : !responsavel ? 'responsável desconhecido' : membroOrigem && !membro ? 'membro desconhecido'
    : categoria === 'Dízimo' && !membro ? 'dízimo sem nome' : null;
  if (motivo) {
    problemas.push(`linha ${i + 2}: ${motivo} — ${JSON.stringify(l).slice(0, 140)}`);
    continue;
  }
  lancamentos.push({
    id: uuidDe('movimentacao', idOrigem),
    data, tipo, categoria, centavos, responsavel,
    // Entrada: a descrição é o nome de quem contribuiu e a anotação vira observação.
    // Saída: a anotação É a descrição da despesa (sem anotação, fica "Gasto", como estava no AppSheet).
    descricao: tipo === 'Entrada' ? membro?.nome ?? '' : texto || 'Gasto',
    observacao: tipo === 'Entrada' ? texto : '',
    membroId: tipo === 'Entrada' && membro ? membro.id : null,
    forma: limpar(forma),
    // O AppSheet não guardava a hora: usa meio-dia do dia, mantendo a ordem original da planilha.
    criadoEm: new Date(Date.parse(data + 'T15:00:00Z') + i * 1000).toISOString(),
  });
}

const reais = (c) => 'R$ ' + (c / 100).toFixed(2);
const soma = (f) => lancamentos.filter(f).reduce((s, l) => s + l.centavos, 0);
console.log(`AppSheet: ${lancamentos.length} movimentação(ões) válida(s), ${problemas.length} com problema, ${membros.length} membro(s).`);
console.log(`Responsáveis: ${[...responsaveis.entries()].map(([k, v]) => k + ' = ' + v).join(', ')}`);
const meses = [...new Set(lancamentos.map((l) => l.data.slice(0, 7)))].sort();
let caixa = 0;
for (const m of meses) {
  const e = soma((l) => l.tipo === 'Entrada' && l.data.startsWith(m));
  const s = soma((l) => l.tipo === 'Saída' && l.data.startsWith(m));
  caixa += e - s;
  console.log(`  ${m}: entradas ${reais(e).padStart(12)} · saídas ${reais(s).padStart(10)} · caixa acumulado ${reais(caixa).padStart(12)}`);
}
console.log(`Total: entradas ${reais(soma((l) => l.tipo === 'Entrada'))} (dízimos ${reais(soma((l) => l.categoria === 'Dízimo'))}, ofertas ${reais(soma((l) => l.categoria === 'Oferta'))}) · saídas ${reais(soma((l) => l.tipo === 'Saída'))}`);
for (const p of problemas) console.log('  ⚠ ' + p);

const atuais = await sql(`select
  (select count(*)::int from public.lancamentos where excluido_em is null) as lancamentos,
  (select count(*)::int from public.membros where excluido_em is null) as membros`);
console.log(`\nNo banco hoje: ${atuais[0].lancamentos} lançamento(s) e ${atuais[0].membros} membro(s) ativos.`);

if (!APLICAR) {
  console.log('Nada foi gravado. Para substituir os dados do banco pelos do AppSheet: acrescente --aplicar');
  process.exit(0);
}
if (problemas.length) {
  console.error('Há linhas com problema: corrija antes de aplicar.');
  process.exit(1);
}

const idsL = lancamentos.map((l) => q(l.id)).join(',');
const idsM = membros.map((m) => q(m.id)).join(',');
await sql(`begin;
-- 1) o que existia eram testes: sai da lista (fica marcado como excluído, e os celulares recebem a exclusão)
update public.lancamentos set excluido_em = now(), excluido_por = 'limpeza dos testes (importação do AppSheet)'
 where excluido_em is null and id not in (${idsL});
update public.membros set excluido_em = now() where excluido_em is null and id not in (${idsM});
-- 2) dados verdadeiros do AppSheet
insert into public.membros (id, nome) values
${membros.map((m) => `(${q(m.id)}, ${q(m.nome)})`).join(',\n')}
on conflict (id) do update set nome = excluded.nome, excluido_em = null;
insert into public.lancamentos (id, data_referencia, tipo, categoria, descricao, membro_id, valor_centavos, responsavel, usuario_email, criado_em, forma_pagamento, observacao) values
${lancamentos.map((l) => `(${q(l.id)}, ${q(l.data)}, ${q(l.tipo)}, ${q(l.categoria)}, ${q(l.descricao)}, ${q(l.membroId)}, ${l.centavos}, ${q(l.responsavel)}, 'importado do AppSheet', ${q(l.criadoEm)}, ${q(l.forma)}, ${q(l.observacao)})`).join(',\n')}
on conflict (id) do nothing;
commit;`);

const depois = await sql(`select count(*)::int as n,
  coalesce(sum(valor_centavos) filter (where tipo = 'Entrada'), 0)::bigint as entradas,
  coalesce(sum(valor_centavos) filter (where tipo = 'Saída'), 0)::bigint as saidas
  from public.lancamentos where excluido_em is null`);
console.log(`\nConcluído. No banco agora: ${depois[0].n} lançamento(s) · entradas ${reais(Number(depois[0].entradas))} · saídas ${reais(Number(depois[0].saidas))} · caixa ${reais(Number(depois[0].entradas) - Number(depois[0].saidas))}`);
