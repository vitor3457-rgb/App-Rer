# MIGRACAO.md — Migração para Expo + Supabase (preparação)

> **NÃO iniciar a programação sem o aval do usuário.** Ele vai trocar o modelo de IA
> (para o Fable) antes. Quando tudo abaixo estiver pronto, PEDIR permissão.

## Dados já recebidos
- **Supabase**
  - Projeto: `ADRER-Financeiro` · Project ID `nkkqbqvhuumtlywlstws` · região `sa-east-1` (São Paulo)
  - Project URL: `https://nkkqbqvhuumtlywlstws.supabase.co`
  - Chave publishable (pública, vai dentro do app): `sb_publishable_IpVy9EsF4wxUAL-M7HuUSg_lwzsEHrP`
  - Dono: vitor3457@gmail.com. **Nunca** pedir no chat a senha do banco nem a chave secret/service_role
    (se precisar, usar o formulário seguro de credenciais).
- **Expo**: usuário `Gabs_DevAi` (sem token ainda — pedir pelo formulário seguro quando for gerar o APK).
- **Login no app novo**: opção **B — entrar com a conta Google** (via Supabase Auth; exige criar
  um OAuth Client no Google Cloud — o usuário fará os cliques guiado).
- **Usuários**: vitor3457@gmail.com · tesoureiro: e-mail **pendente** (o usuário vai ver com ele).
- **Extras da 1ª versão (todos aprovados)**: funcionar sem internet (envia depois), foto do comprovante,
  modo escuro, busca e filtros, comparar meses no dashboard, cadastro de membros/dizimistas,
  lembrete (notificação).
- **Importar lançamentos da planilha atual**: SIM.

## Melhoria pedida: saldo acumulado ("caixa")
Hoje cada mês começa do zero. No app novo, o mês deve começar com o saldo do mês anterior
(como um extrato): **Saldo inicial do mês + Entradas − Saídas = Saldo final (em caixa)**.
- Precisará de um **saldo de abertura** (quanto havia em caixa antes do 1º lançamento) — perguntar ao usuário.
- Mostrar no dashboard, na lista do mês, no Excel e no PDF.

## Ambiente (feito)
- Ambiente de nuvem pessoal **App-Rer** criado (env_01AghuATFfkyjeasnZuURJY8), com acesso a:
  o projeto Supabase, api.supabase.com, expo.dev, api.expo.dev, u.expo.dev, storage.googleapis.com.
  Testado: Supabase e Expo respondem.

## O app atual continua no ar
Web app Google Apps Script (veja PROGRESS.md) até o novo estar pronto e testado.
