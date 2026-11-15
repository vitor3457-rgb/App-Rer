-- Guarda duas informações que já existiam no app antigo (AppSheet) e que não podem se perder:
--  * forma_pagamento: 'PIX', 'Dinheiro'... (vazio = não informado)
--  * observacao: anotação livre do lançamento (ex.: "Retirado da salva")
alter table public.lancamentos
  add column forma_pagamento text not null default '',
  add column observacao text not null default '',
  add constraint lanc_forma_pagamento check (char_length(forma_pagamento) <= 30),
  add constraint lanc_observacao check (char_length(observacao) <= 500);

-- A visão para dashboards externos ganha as duas colunas no fim.
create or replace view public.vw_lancamentos with (security_invoker = true) as
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
  l.responsavel,
  l.forma_pagamento,
  l.observacao
from public.lancamentos l
where l.excluido_em is null;
