-- ============================================================
--  ADRER Financeiro — estrutura inicial do banco (Supabase/Postgres)
--  Regras gerais:
--   * dinheiro sempre em CENTAVOS inteiros (valor_centavos);
--   * nada é apagado de verdade: "excluir" preenche excluido_em (auditoria);
--   * atualizado_em é carimbado pelo servidor e serve de cursor para a sincronização;
--   * só usa o app quem está na tabela "usuarios" (lista de e-mails + papel).
-- ============================================================

create schema if not exists privado;

-- ------------------------------------------------------------
--  USUÁRIOS AUTORIZADOS
-- ------------------------------------------------------------
create table public.usuarios (
  email         text primary key,
  nome          text not null default '',
  papel         text not null default 'tesoureiro',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint usuarios_email_valido check (email = lower(btrim(email)) and email like '%_@_%._%'),
  constraint usuarios_papel_valido check (papel in ('admin', 'tesoureiro', 'leitor')),
  constraint usuarios_nome_tamanho check (char_length(nome) <= 80)
);
comment on table public.usuarios is
  'Contas Google que podem usar o app. papel: admin (tudo), tesoureiro (lança e exclui), leitor (só vê).';

-- ------------------------------------------------------------
--  Funções auxiliares (ficam no schema "privado", fora da API)
-- ------------------------------------------------------------
create or replace function privado.email_atual() returns text
language sql stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function privado.papel_atual() returns text
language sql stable security definer
set search_path = ''
as $$
  select u.papel
  from public.usuarios u
  where u.ativo
    and u.email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function privado.pode_ler() returns boolean
language sql stable
set search_path = ''
as $$ select privado.papel_atual() is not null $$;

create or replace function privado.pode_escrever() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(privado.papel_atual() in ('admin', 'tesoureiro'), false) $$;

create or replace function privado.eh_admin() returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(privado.papel_atual() = 'admin', false) $$;

-- Carimba atualizado_em em qualquer alteração.
create or replace function privado.carimbar() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then
    new.criado_em := old.criado_em;
  end if;
  return new;
end
$$;

-- ------------------------------------------------------------
--  RESPONSÁVEIS (quem está fazendo o lançamento: Alex, Júlio, Lázaro...)
-- ------------------------------------------------------------
create table public.responsaveis (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  ativo         boolean not null default true,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint responsaveis_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 60)
);
create unique index responsaveis_nome_unico on public.responsaveis (lower(nome));
create index responsaveis_atualizado_idx on public.responsaveis (atualizado_em);

-- ------------------------------------------------------------
--  MEMBROS / CONTRIBUINTES (quem deu o dízimo ou a oferta)
-- ------------------------------------------------------------
create table public.membros (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text not null default '',
  observacao    text not null default '',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz,
  constraint membros_nome_valido check (btrim(nome) <> '' and char_length(nome) <= 120),
  constraint membros_textos_tamanho check (char_length(telefone) <= 40 and char_length(observacao) <= 500)
);
create index membros_atualizado_idx on public.membros (atualizado_em);

-- ------------------------------------------------------------
--  LANÇAMENTOS
-- ------------------------------------------------------------
create table public.lancamentos (
  id              uuid primary key,              -- gerado no celular: reenviar não duplica
  data_referencia date not null,
  tipo            text not null,                 -- 'Entrada' | 'Saída'
  categoria       text not null,                 -- 'Dízimo' | 'Oferta' | 'Despesa'
  descricao       text not null default '',      -- Saída: o que foi a despesa. Entrada: nome de quem contribuiu.
  membro_id       uuid references public.membros (id) on delete set null,
  valor_centavos  bigint not null,
  responsavel     text not null,
  comprovante     text,                          -- caminho do arquivo no bucket "comprovantes"
  usuario_email   text not null default '',      -- conta que lançou (carimbada pelo servidor)
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz,
  excluido_por    text,
  constraint lanc_tipo_categoria check (
    (tipo = 'Entrada' and categoria in ('Dízimo', 'Oferta'))
    or (tipo = 'Saída' and categoria = 'Despesa')
  ),
  constraint lanc_valor check (valor_centavos > 0 and valor_centavos <= 100000000),
  constraint lanc_descricao check (
    char_length(descricao) <= 200 and (categoria = 'Oferta' or btrim(descricao) <> '')
  ),
  constraint lanc_responsavel check (btrim(responsavel) <> '' and char_length(responsavel) <= 60),
  constraint lanc_data check (data_referencia between date '2020-01-01' and date '2100-12-31'),
  constraint lanc_membro_so_entrada check (membro_id is null or tipo = 'Entrada'),
  constraint lanc_comprovante_tamanho check (comprovante is null or char_length(comprovante) <= 300)
);
create index lanc_data_idx on public.lancamentos (data_referencia);
create index lanc_atualizado_idx on public.lancamentos (atualizado_em);
create index lanc_membro_idx on public.lancamentos (membro_id) where membro_id is not null;

create or replace function privado.lancamento_antes() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_email text := privado.email_atual();
begin
  new.atualizado_em := now();
  new.descricao := btrim(regexp_replace(new.descricao, '\s+', ' ', 'g'));
  new.responsavel := btrim(new.responsavel);

  if tg_op = 'INSERT' then
    -- Pelo app, a conta vem do login (não dá para lançar em nome de outra pessoa).
    -- Sem login (importação feita pelo administrador do banco), vale o que foi informado.
    if v_email <> '' then
      new.usuario_email := v_email;
      new.excluido_em := null;
      new.excluido_por := null;
    end if;
    if new.criado_em is null or new.criado_em > now() + interval '10 minutes' then
      new.criado_em := now();
    end if;
    return new;
  end if;

  -- UPDATE
  new.criado_em := old.criado_em;
  new.usuario_email := old.usuario_email;
  if old.excluido_em is null and new.excluido_em is not null then
    new.excluido_em := now();
    new.excluido_por := coalesce(nullif(v_email, ''), new.excluido_por, '');
  elsif old.excluido_em is not null and new.excluido_em is not null then
    new.excluido_em := old.excluido_em;
    new.excluido_por := old.excluido_por;
  elsif new.excluido_em is null then
    new.excluido_por := null;
  end if;
  return new;
end
$$;

create trigger lancamentos_antes
  before insert or update on public.lancamentos
  for each row execute function privado.lancamento_antes();

-- Se o nome do membro mudar, os lançamentos ligados a ele acompanham.
create or replace function privado.membro_renomeado() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.nome is distinct from old.nome then
    update public.lancamentos
       set descricao = new.nome
     where membro_id = new.id
       and descricao is distinct from new.nome;
  end if;
  return new;
end
$$;

create trigger membros_carimbo before insert or update on public.membros
  for each row execute function privado.carimbar();
create trigger membros_renomeado after update of nome on public.membros
  for each row execute function privado.membro_renomeado();
create trigger responsaveis_carimbo before insert or update on public.responsaveis
  for each row execute function privado.carimbar();
create trigger usuarios_carimbo before insert or update on public.usuarios
  for each row execute function privado.carimbar();

-- Nunca ficar sem nenhum administrador ativo.
create or replace function privado.manter_um_admin() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.usuarios where papel = 'admin' and ativo) then
    raise exception 'É preciso manter pelo menos um administrador ativo.'
      using errcode = 'check_violation';
  end if;
  return null;
end
$$;

create constraint trigger usuarios_um_admin
  after update or delete on public.usuarios
  deferrable initially deferred
  for each row execute function privado.manter_um_admin();

-- ------------------------------------------------------------
--  CONFIGURAÇÕES (ex.: saldo de abertura do caixa)
-- ------------------------------------------------------------
create table public.configuracoes (
  chave         text primary key,
  valor         jsonb not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_chave_valida check (chave ~ '^[a-z_]{1,60}$')
);
create trigger configuracoes_carimbo before insert or update on public.configuracoes
  for each row execute function privado.carimbar();

-- ------------------------------------------------------------
--  SEGURANÇA (RLS): cada tabela só responde a quem está em "usuarios"
-- ------------------------------------------------------------
alter table public.usuarios      enable row level security;
alter table public.responsaveis  enable row level security;
alter table public.membros       enable row level security;
alter table public.lancamentos   enable row level security;
alter table public.configuracoes enable row level security;

revoke all on public.usuarios, public.responsaveis, public.membros,
              public.lancamentos, public.configuracoes from anon, authenticated;
grant select, insert, update, delete on public.usuarios      to authenticated;
grant select, insert, update          on public.responsaveis  to authenticated;
grant select, insert, update          on public.membros       to authenticated;
grant select, insert, update          on public.lancamentos   to authenticated;
grant select, insert, update          on public.configuracoes to authenticated;

grant usage on schema privado to authenticated;
revoke all on all functions in schema privado from public, anon;
grant execute on function privado.email_atual(), privado.papel_atual(), privado.pode_ler(),
                          privado.pode_escrever(), privado.eh_admin() to authenticated;

-- usuarios: cada um vê a própria linha; o admin vê e gerencia todas.
create policy usuarios_ler on public.usuarios for select to authenticated
  using (email = (select privado.email_atual()) or (select privado.eh_admin()));
create policy usuarios_incluir on public.usuarios for insert to authenticated
  with check ((select privado.eh_admin()));
create policy usuarios_alterar on public.usuarios for update to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));
create policy usuarios_remover on public.usuarios for delete to authenticated
  using ((select privado.eh_admin()));

-- responsaveis e configuracoes: todos os autorizados leem; só o admin altera.
create policy responsaveis_ler on public.responsaveis for select to authenticated
  using ((select privado.pode_ler()));
create policy responsaveis_incluir on public.responsaveis for insert to authenticated
  with check ((select privado.eh_admin()));
create policy responsaveis_alterar on public.responsaveis for update to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

create policy configuracoes_ler on public.configuracoes for select to authenticated
  using ((select privado.pode_ler()));
create policy configuracoes_incluir on public.configuracoes for insert to authenticated
  with check ((select privado.eh_admin()));
create policy configuracoes_alterar on public.configuracoes for update to authenticated
  using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- membros e lancamentos: todos os autorizados leem; admin e tesoureiro gravam.
create policy membros_ler on public.membros for select to authenticated
  using ((select privado.pode_ler()));
create policy membros_incluir on public.membros for insert to authenticated
  with check ((select privado.pode_escrever()));
create policy membros_alterar on public.membros for update to authenticated
  using ((select privado.pode_escrever())) with check ((select privado.pode_escrever()));

create policy lancamentos_ler on public.lancamentos for select to authenticated
  using ((select privado.pode_ler()));
create policy lancamentos_incluir on public.lancamentos for insert to authenticated
  with check ((select privado.pode_escrever()));
create policy lancamentos_alterar on public.lancamentos for update to authenticated
  using ((select privado.pode_escrever())) with check ((select privado.pode_escrever()));

-- ------------------------------------------------------------
--  VISÃO PARA DASHBOARD EXTERNO (Looker Studio / Power BI)
--  Mesmo formato da planilha antiga: uma linha por lançamento válido.
-- ------------------------------------------------------------
create view public.vw_lancamentos with (security_invoker = true) as
select
  l.id,
  l.criado_em                                   as data_hora_lancamento,
  l.data_referencia,
  extract(year from l.data_referencia)::int     as ano,
  extract(month from l.data_referencia)::int    as mes,
  l.tipo,
  l.categoria,
  l.descricao,
  (l.valor_centavos / 100.0)::numeric(14, 2)    as valor,
  l.usuario_email                               as usuario,
  l.responsavel
from public.lancamentos l
where l.excluido_em is null;

revoke all on public.vw_lancamentos from anon, authenticated;
grant select on public.vw_lancamentos to authenticated;

-- ------------------------------------------------------------
--  COMPROVANTES (fotos) — bucket privado no Storage
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy comprovantes_ler on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (select privado.pode_ler()));
create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (select privado.pode_escrever()));
create policy comprovantes_trocar on storage.objects for update to authenticated
  using (bucket_id = 'comprovantes' and (select privado.pode_escrever()))
  with check (bucket_id = 'comprovantes' and (select privado.pode_escrever()));
create policy comprovantes_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and (select privado.pode_escrever()));

-- ------------------------------------------------------------
--  DADOS INICIAIS
-- ------------------------------------------------------------
insert into public.usuarios (email, nome, papel) values
  ('vitor3457@gmail.com', 'Vitor', 'admin');

insert into public.responsaveis (nome, ordem) values
  ('Alex', 1), ('Júlio', 2), ('Lázaro', 3);

insert into public.configuracoes (chave, valor) values
  ('saldo_abertura_centavos', '0'::jsonb),
  ('responsavel_padrao', '"Alex"'::jsonb);
