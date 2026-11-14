# CLAUDE.md — App Financeiro da Igreja

> **Ao iniciar qualquer sessão, leia o PROGRESS.md e continue da próxima etapa pendente.**
> Ao terminar cada etapa: atualize o PROGRESS.md (feito, falta, próximo passo exato,
> pendências do usuário), faça commit e `git push -u origin claude/church-finance-app-h1epmv`.
> O container da nuvem é apagado depois de um tempo: o que não foi enviado ao GitHub se perde.

## FASE 2 (em andamento): app nativo Expo + Supabase
O usuário pediu a migração para um app Android "de verdade". Leia **PROGRESS.md** (etapas M1–M16)
e **MIGRACAO.md** (dados e decisões). Resumo da arquitetura nova:
- `app/` — Expo (SDK 58, TypeScript, Expo Router). Lógica pura em `app/src/core` (testada com Jest),
  dados em `app/src/dados` (cache local + fila offline; "remoto" Supabase ou demo), telas em `app/src/app`.
- `supabase/` — migrações SQL e scripts. Aplicar com a Management API
  (`POST https://api.supabase.com/v1/projects/nkkqbqvhuumtlywlstws/database/query`,
  cabeçalho `Authorization: Bearer proxy-injected` — o proxy troca pelo token real).
- Segurança: login Google (Supabase Auth) + tabela `usuarios` (lista de e-mails e papéis) + RLS.
- Dinheiro sempre em **centavos inteiros**; datas de referência como texto `AAAA-MM-DD`.
- Offline: todo lançamento nasce no celular com UUID próprio, entra na fila e é enviado por upsert (não duplica).
- Saldo acumulado: saldo inicial do mês = saldo de abertura + tudo o que veio antes.
- Não dá para rodar Android aqui: testar pela versão web (`expo export -p web` + Playwright, modo demo)
  e pedir ao usuário o teste no celular com o APK (EAS Build).
- **Nunca** pedir senha/chave secreta no chat: usar o formulário seguro (request_credential).
- A Fase 1 (abaixo) continua publicada até a troca; não quebrar `src/` nem `dev/`.

## Resumo do projeto
App de controle financeiro para uma igreja pequena (até 100 membros), usado por
2 pessoas (o dono do projeto e o tesoureiro), cada uma no próprio celular Android.
Os dois gravam no MESMO Google Sheets, que funciona como banco de dados e no futuro
será ligado a um dashboard (Looker Studio / Power BI).

O dono do projeto **não é programador**: Claude faz todo o código e só pede ao usuário
o que exige ação dele (login, autorização, cliques no Google). **Tudo em português.**

## Arquitetura
- **Google Apps Script** (HtmlService) publicado como *web app* na conta Google do dono.
- Projeto **vinculado** (container-bound) à planilha, criado com `clasp create --type sheets`.
- Web app executa **como o usuário que acessa** (`USER_ACCESSING`) e acesso "qualquer pessoa
  com conta Google" (`ANYONE`). Motivo: em contas Gmail comuns, só assim o e-mail de quem
  usa o app fica disponível (`Session.getActiveUser()`). A segurança vem de duas camadas:
  1. lista de e-mails autorizados em `src/Config.js` (`USUARIOS_AUTORIZADOS`);
  2. a planilha só é compartilhada (como Editor) com as pessoas autorizadas.
- Instalação no Android: atalho na tela inicial pelo Chrome ("Adicionar à tela inicial").
  Apps Script não permite PWA completo (manifest), então usamos atalho + meta tags.
- Gravações e exclusões usam `LockService.getScriptLock()` (2 pessoas ao mesmo tempo).
- O ID do lançamento é gerado no celular e conferido no servidor: se a internet cair
  e a pessoa tocar em Salvar de novo, não duplica.

## Planilha (aba `Lancamentos`, cabeçalho na linha 1, uma linha por lançamento)
`ID | Data/hora do lançamento | Data de referência | Ano | Mês | Tipo | Categoria | Descrição | Valor | Usuário`
- Tipo: `Entrada` ou `Saída`.
- Entrada → Categoria `Dízimo` ou `Oferta` (Descrição opcional/vazia).
- Saída → Categoria `Despesa` e Descrição obrigatória (texto livre).
- Valor: número positivo, 2 casas decimais (formato `R$ #,##0.00`).
- Ano e Mês (1–12) vêm da Data de referência (facilita o dashboard).
- Aba extra `Excluidos`: cópia de cada lançamento excluído + quem/quando excluiu (auditoria).
  Não interfere no dashboard (que deve ler só `Lancamentos`).

## Estrutura de arquivos
- `src/` — código enviado ao Google pelo clasp (`rootDir`).
  - `appsscript.json` — manifesto (fuso `America/Sao_Paulo`, config do web app).
  - `Config.js` — **lista de e-mails autorizados**, anos disponíveis, ID da planilha.
  - `Codigo.js` — servidor: `doGet`, acesso, salvar, listar, excluir.
  - `Index.html`, `Estilos.html`, `Script.html` — interface (Tela 1 e Tela 2).
- `dev/` — ferramentas locais (não vão para o Google): simulação do Apps Script em Node,
  testes do servidor, pré-visualização da interface e testes com Playwright.
- `README.md` — guia para os usuários (instalar no Android, adicionar usuário etc.).
- `PROGRESS.md` — plano em etapas e estado atual.

## Comandos
- `npm test` — testes do servidor (simulação local, sem Google).
- `npm run preview` — gera `dev/preview.html` com o Google simulado (abrir no navegador).
- `npm run test:ui` — testa a interface no Chromium (tamanho de celular) e tira prints.
- `npx clasp push` — envia `src/` para o Google (exige `clasp login`).
- `npm run publicar` — push + atualiza a MESMA implantação (o link do app não muda).
  O ID da implantação fica em `deploy.json`.

## Regras importantes
- Nunca commitar credenciais (`~/.clasprc.json`, tokens). `.clasp.json` (scriptId) pode.
- Para atualizar o app publicado, use sempre `npm run publicar` (reaproveita a
  implantação). `clasp deploy` sem `-i` cria um link NOVO — evite.
- O login do clasp fica só no container; numa sessão nova é preciso logar de novo
  (`clasp login --no-localhost`, o usuário cola a URL de retorno no chat).
