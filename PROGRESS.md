# PROGRESS.md — Andamento do projeto

> Ao iniciar qualquer sessão, leia este arquivo e continue da **próxima etapa pendente**.
> Legenda: [x] feito · [ ] pendente · [U] depende de ação do usuário

## Plano (etapas pequenas e numeradas)

1. [x] Estrutura inicial: repositório git, CLAUDE.md, PROGRESS.md, .gitignore.
2. [x] Manifesto e configuração: `package.json`, `src/appsscript.json`, `src/Config.js`.
3. [x] Servidor `src/Codigo.js`: `doGet`, controle de acesso, criação da aba/cabeçalho,
       salvar (com LockService e anti-duplicação), listar mês, excluir (com auditoria).
4. [x] Testes automáticos do servidor em `dev/` (simulação do Apps Script em Node).
5. [ ] Interface — Tela 1 (Novo lançamento).
6. [ ] Interface — Tela 2 (Lançamentos do mês, totais, excluir).
7. [ ] Pré-visualização local + testes de interface no Chromium (tamanho de celular).
8. [ ] Guia do usuário (`README.md`): instalar no Android, adicionar/remover usuário,
       adicionar o ano de 2027.
9. [U] Ativar a API do Apps Script e fazer `clasp login` (passo a passo para o usuário).
10. [ ] Criar planilha + projeto (`clasp create --type sheets`), `clasp push`, publicar
        (`clasp deploy`), salvar IDs em `.clasp.json`/`deploy.json`/`Config.js`.
11. [U] Primeiro acesso do dono: autorizar o app e fazer um lançamento de teste.
12. [U] Informar o e-mail Google do tesoureiro → adicionar na lista, compartilhar a
        planilha, republicar; tesoureiro autoriza e instala no celular.
13. [ ] Entrega final: link do app, link da planilha, instruções.

## Estado atual
- **Última etapa concluída:** 4
- **Próximo passo exato:** etapa 5 — escrever `src/Index.html`, `src/Estilos.html`, `src/Script.html` (Tela 1).

## Pendências que dependem do usuário
- **GitHub sem permissão de escrita** (push dá 403 "Resource not accessible by integration").
  O usuário precisa liberar o repositório App-Rer no app do Claude no GitHub
  (https://github.com/apps/claude/installations/select_target) ou reconectar em
  https://claude.ai/connect-github. Enquanto isso os commits ficam só no container —
  assim que liberar: `git push -u origin claude/church-finance-app-h1epmv`.

## Registro
- Etapa 1: criados CLAUDE.md, PROGRESS.md, .gitignore.
- Etapa 2: package.json (clasp 3.4.1 como dependência de dev; scripts test/preview/test:ui/push/publicar),
  src/appsscript.json (fuso São Paulo, web app USER_ACCESSING + ANYONE), src/Config.js.
- Etapa 3: src/Codigo.js (doGet, acesso por lista de e-mails, aba criada com cabeçalho/formatos,
  salvar com LockService + anti-duplicação por ID, listar mês com totais em centavos,
  excluir com cópia na aba Excluidos) e src/AcessoNegado.html.
- Etapa 4: dev/gas-mock.js (simulação do Apps Script) e dev/testes-servidor.js — 28 testes passando (`npm test`).
