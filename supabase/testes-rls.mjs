// Testes de segurança e de regras do banco (RLS, gatilhos e restrições).
// Cada teste roda dentro de um bloco que SEMPRE termina em erro proposital,
// então o Postgres desfaz tudo: nada fica gravado no banco de verdade.
// Rodar: npm run banco:testar
import { sql } from './api.mjs';

const ADMIN = 'vitor3457@gmail.com';
const TES = 'tes@teste.adrer.br';
const LEITOR = 'lei@teste.adrer.br';
const INATIVO = 'ina@teste.adrer.br';
const INTRUSO = 'intruso@gmail.com';
const M1 = '11111111-1111-4111-8111-111111111111';
const L1 = '22222222-2222-4222-8222-222222222222';
const L2 = '33333333-3333-4333-8333-333333333333';
const NOVO = '44444444-4444-4444-8444-444444444444';

const PREPARO = `
  insert into public.usuarios (email, nome, papel, ativo) values
    ('${TES}', 'Tesoureiro', 'tesoureiro', true),
    ('${LEITOR}', 'Leitor', 'leitor', true),
    ('${INATIVO}', 'Inativo', 'tesoureiro', false);
  insert into public.membros (id, nome) values ('${M1}', 'Silvana');
  insert into public.lancamentos (id, data_referencia, tipo, categoria, descricao, membro_id, valor_centavos, responsavel, usuario_email) values
    ('${L1}', '2026-11-01', 'Entrada', 'Dízimo', 'Silvana', '${M1}', 5000, 'Alex', '${ADMIN}'),
    ('${L2}', '2026-11-02', 'Saída', 'Despesa', 'Aluguel', null, 80000, 'Alex', '${ADMIN}');
`;

const INSERIR_LANC = (id = NOVO, extra = {}) => {
  const l = Object.assign({
    data: '2026-11-08', tipo: 'Entrada', categoria: 'Oferta', descricao: '', valor: 1000,
    responsavel: 'Alex', email: 'outra@pessoa.com',
  }, extra);
  return `insert into public.lancamentos (id, data_referencia, tipo, categoria, descricao, valor_centavos, responsavel, usuario_email)
          values ('${id}', '${l.data}', '${l.tipo}', '${l.categoria}', '${l.descricao}', ${l.valor}, '${l.responsavel}', '${l.email}')`;
};
const CONTAR = (consulta) => `select count(*) into v_n from (${consulta}) q; v_txt := v_n::text;`;
const EXECUTAR = (comando) => `${comando}; get diagnostics v_n = row_count; v_txt := v_n::text;`;
const VALOR = (expr, antes = '') => `${antes} select (${expr})::text into v_txt;`;

/** quem: e-mail (logado), 'anon' (sem login) ou null (administrador do banco). */
async function rodar(quem, corpo) {
  let papel = '';
  if (quem === 'anon') {
    papel = `perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;`;
  } else if (quem) {
    const claims = JSON.stringify({ email: quem, role: 'authenticated', sub: '99999999-9999-4999-8999-999999999999' });
    papel = `perform set_config('request.jwt.claims', '${claims}', true); set local role authenticated;`;
  }
  const bloco = `
    do $do$
    declare v_n bigint; v_txt text;
    begin
      ${PREPARO}
      ${papel}
      begin
        ${corpo}
      exception when others then
        v_txt := 'ERRO ' || sqlstate;
      end;
      raise exception 'RESULTADO|%', coalesce(v_txt, 'NULL');
    end $do$;`;
  try {
    await sql(bloco);
    return 'SEM RESULTADO';
  } catch (e) {
    const m = /RESULTADO\|([^\n]*)/.exec(e.message);
    return m ? m[1].trim() : 'FALHA DO TESTE: ' + e.message.slice(0, 300);
  }
}

const NEGADO = 'ERRO 42501';     // sem permissão (RLS)
const REGRA = 'ERRO 23514';      // violou uma regra (check)

const testes = [
  // ---- quem não está na lista não vê nem grava nada ----
  ['intruso não vê lançamentos', INTRUSO, CONTAR('select 1 from public.lancamentos'), '0'],
  ['intruso não vê membros', INTRUSO, CONTAR('select 1 from public.membros'), '0'],
  ['intruso não vê responsáveis', INTRUSO, CONTAR('select 1 from public.responsaveis'), '0'],
  ['intruso não vê configurações', INTRUSO, CONTAR('select 1 from public.configuracoes'), '0'],
  ['intruso não vê usuários', INTRUSO, CONTAR('select 1 from public.usuarios'), '0'],
  ['intruso não vê a visão do dashboard', INTRUSO, CONTAR('select 1 from public.vw_lancamentos'), '0'],
  ['intruso não insere lançamento', INTRUSO, EXECUTAR(INSERIR_LANC()), NEGADO],
  ['intruso não exclui lançamento', INTRUSO, EXECUTAR(`update public.lancamentos set excluido_em = now() where id = '${L1}'`), '0'],
  ['intruso não se cadastra como usuário', INTRUSO, EXECUTAR(`insert into public.usuarios (email, papel) values ('${INTRUSO}', 'admin')`), NEGADO],
  ['intruso não vê comprovantes', INTRUSO, CONTAR(`select 1 from storage.objects where bucket_id = 'comprovantes'`), '0'],
  ['sem login: acesso negado', 'anon', CONTAR('select 1 from public.lancamentos'), NEGADO],
  ['usuário desativado não vê nada', INATIVO, CONTAR('select 1 from public.lancamentos'), '0'],
  ['usuário desativado não grava', INATIVO, EXECUTAR(INSERIR_LANC()), NEGADO],

  // ---- leitor: só vê ----
  ['leitor vê os lançamentos', LEITOR, CONTAR('select 1 from public.lancamentos'), '2'],
  ['leitor não insere', LEITOR, EXECUTAR(INSERIR_LANC()), NEGADO],
  ['leitor não exclui', LEITOR, EXECUTAR(`update public.lancamentos set excluido_em = now() where id = '${L1}'`), '0'],
  ['leitor vê só a própria linha em usuários', LEITOR, CONTAR('select 1 from public.usuarios'), '1'],

  // ---- tesoureiro: lança e exclui, mas não administra ----
  ['tesoureiro vê os lançamentos', TES, CONTAR('select 1 from public.lancamentos'), '2'],
  ['tesoureiro insere lançamento', TES, EXECUTAR(INSERIR_LANC()), '1'],
  ['conta do lançamento vem do login (não do que o app mandou)', TES,
    VALOR(`select usuario_email from public.lancamentos where id = '${NOVO}'`, INSERIR_LANC() + ';'), TES],
  ['reenviar o mesmo lançamento não duplica (upsert)', TES,
    CONTAR(`select 1 from public.lancamentos where id = '${NOVO}'`).replace('select count', `
      ${INSERIR_LANC()};
      ${INSERIR_LANC()} on conflict (id) do update set valor_centavos = excluded.valor_centavos, descricao = excluded.descricao;
      select count`), '1'],
  ['excluir registra quem e quando', TES,
    VALOR(`select excluido_por || '|' || (excluido_em is not null)::text from public.lancamentos where id = '${L1}'`,
      `update public.lancamentos set excluido_em = '2020-01-01' where id = '${L1}';`), TES + '|true'],
  ['excluído some da visão do dashboard', TES,
    CONTAR('select 1 from public.vw_lancamentos').replace('select count', `update public.lancamentos set excluido_em = now() where id = '${L1}'; select count`), '1'],
  ['não dá para trocar a conta que lançou', TES,
    VALOR(`select usuario_email from public.lancamentos where id = '${L1}'`,
      `update public.lancamentos set usuario_email = 'x@y.com' where id = '${L1}';`), ADMIN],
  ['tesoureiro cadastra membro', TES, EXECUTAR(`insert into public.membros (nome) values ('Gabriel')`), '1'],
  ['renomear membro atualiza os lançamentos dele', TES,
    VALOR(`select descricao from public.lancamentos where id = '${L1}'`,
      `update public.membros set nome = 'Silvana Souza' where id = '${M1}';`), 'Silvana Souza'],
  ['tesoureiro não inclui usuário', TES, EXECUTAR(`insert into public.usuarios (email) values ('novo@gmail.com')`), NEGADO],
  ['tesoureiro não vira admin', TES, EXECUTAR(`update public.usuarios set papel = 'admin' where email = '${TES}'`), '0'],
  ['tesoureiro não muda o saldo de abertura', TES, EXECUTAR(`update public.configuracoes set valor = '999'::jsonb`), '0'],
  ['tesoureiro não cria responsável', TES, EXECUTAR(`insert into public.responsaveis (nome) values ('Pedro')`), NEGADO],
  ['tesoureiro não apaga linha de verdade (sem DELETE)', TES, EXECUTAR(`delete from public.lancamentos where id = '${L1}'`), NEGADO],

  // ---- admin ----
  ['admin vê todos os usuários', ADMIN, CONTAR('select 1 from public.usuarios'), '4'],
  ['admin inclui usuário', ADMIN, EXECUTAR(`insert into public.usuarios (email, nome, papel) values ('novo@gmail.com', 'Novo', 'tesoureiro')`), '1'],
  ['admin muda o saldo de abertura', ADMIN, EXECUTAR(`update public.configuracoes set valor = '150000'::jsonb where chave = 'saldo_abertura_centavos'`), '1'],
  ['admin cria responsável', ADMIN, EXECUTAR(`insert into public.responsaveis (nome) values ('Pedro')`), '1'],
  ['não pode ficar sem administrador', ADMIN,
    EXECUTAR(`update public.usuarios set papel = 'leitor' where email = '${ADMIN}'; set constraints all immediate`), REGRA],

  // ---- regras dos dados ----
  ['saída sem descrição é recusada', TES, EXECUTAR(INSERIR_LANC(NOVO, { tipo: 'Saída', categoria: 'Despesa', descricao: '  ' })), REGRA],
  ['dízimo sem nome é recusado', TES, EXECUTAR(INSERIR_LANC(NOVO, { categoria: 'Dízimo', descricao: '' })), REGRA],
  ['oferta sem nome é aceita', TES, EXECUTAR(INSERIR_LANC(NOVO, { categoria: 'Oferta', descricao: '' })), '1'],
  ['valor zero é recusado', TES, EXECUTAR(INSERIR_LANC(NOVO, { valor: 0 })), REGRA],
  ['valor acima de R$ 1.000.000 é recusado', TES, EXECUTAR(INSERIR_LANC(NOVO, { valor: 100000001 })), REGRA],
  ['entrada com categoria de saída é recusada', TES, EXECUTAR(INSERIR_LANC(NOVO, { categoria: 'Despesa', descricao: 'x' })), REGRA],
  ['espaços extras da descrição são limpos', TES,
    VALOR(`select descricao from public.lancamentos where id = '${NOVO}'`,
      INSERIR_LANC(NOVO, { tipo: 'Saída', categoria: 'Despesa', descricao: '  Conta   de luz ' }) + ';'), 'Conta de luz'],
  ['e-mail de usuário precisa estar em minúsculas', ADMIN, EXECUTAR(`insert into public.usuarios (email) values ('Maiusculo@Gmail.com')`), REGRA],

  // ---- dados iniciais ----
  ['banco tem os 3 responsáveis iniciais', null, VALOR(`select string_agg(nome, ',' order by ordem) from public.responsaveis`), 'Alex,Júlio,Lázaro'],
  ['visão do dashboard tem valor em reais', null, VALOR(`select valor from public.vw_lancamentos where id = '${L2}'`), '800.00'],
];

let falhas = 0;
for (const [nome, quem, corpo, esperado] of testes) {
  const obtido = await rodar(quem, corpo);
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log((ok ? '  ✔ ' : '  ✘ ') + nome + (ok ? '' : `\n      esperado: ${esperado}\n      obtido:   ${obtido}`));
}
console.log(`\n${testes.length - falhas} de ${testes.length} testes do banco passaram.`);
process.exit(falhas ? 1 : 0);
