# PROGRESS.md — Andamento do projeto

> Ao iniciar qualquer sessão, leia este arquivo e continue da **próxima etapa pendente**.
> Legenda: [x] feito · [ ] pendente · [U] depende de ação do usuário

## Plano (etapas pequenas e numeradas)

1. [x] Estrutura inicial: repositório git, CLAUDE.md, PROGRESS.md, .gitignore.
2. [ ] Manifesto e configuração: `package.json`, `src/appsscript.json`, `src/Config.js`.
3. [ ] Servidor `src/Codigo.js`: `doGet`, controle de acesso, criação da aba/cabeçalho,
       salvar (com LockService e anti-duplicação), listar mês, excluir (com auditoria).
4. [ ] Testes automáticos do servidor em `dev/` (simulação do Apps Script em Node).
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
- **Última etapa concluída:** 1
- **Próximo passo exato:** etapa 2 — criar `package.json`, `src/appsscript.json` e `src/Config.js`.

## Pendências que dependem do usuário
- (ainda nenhuma — serão pedidas na etapa 9)

## Registro
- Etapa 1: criados CLAUDE.md, PROGRESS.md, .gitignore.
