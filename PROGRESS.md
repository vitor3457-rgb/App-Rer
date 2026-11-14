# PROGRESS.md — Andamento do projeto

> Ao iniciar qualquer sessão, leia este arquivo e continue da **próxima etapa pendente**.
> Legenda: [x] feito · [ ] pendente · [U] depende de ação do usuário

## Plano (etapas pequenas e numeradas)

1. [x] Estrutura inicial: repositório git, CLAUDE.md, PROGRESS.md, .gitignore.
2. [x] Manifesto e configuração: `package.json`, `src/appsscript.json`, `src/Config.js`.
3. [x] Servidor `src/Codigo.js`: `doGet`, controle de acesso, criação da aba/cabeçalho,
       salvar (com LockService e anti-duplicação), listar mês, excluir (com auditoria).
4. [x] Testes automáticos do servidor em `dev/` (simulação do Apps Script em Node).
5. [x] Interface — Tela 1 (Novo lançamento).
6. [x] Interface — Tela 2 (Lançamentos do mês, totais, excluir).
7. [x] Pré-visualização local + testes de interface no Chromium (tamanho de celular).
8. [x] Guia do usuário (`README.md`): instalar no Android, adicionar/remover usuário,
       adicionar o ano de 2027.
9. [x] Ativar a API do Apps Script e fazer `clasp login` (passo a passo para o usuário).
10. [x] Criar planilha + projeto (`clasp create --type sheets`), `clasp push`, publicar
        (`clasp deploy`), salvar IDs em `.clasp.json`/`deploy.json`/`Config.js`.
11. [U] Primeiro acesso do dono: autorizar o app e fazer um lançamento de teste.
12. [U] Informar o e-mail Google do tesoureiro → adicionar na lista, compartilhar a
        planilha, republicar; tesoureiro autoriza e instala no celular.
13. [ ] Entrega final: link do app, link da planilha, instruções.

## Pedido novo do usuário (v2) — PUBLICADO (versão 4)
14. [x] Logo da igreja (assets/ + src/Logo.js em base64) e nome curto "ADRER" (Config.NOME_APP;
        nome completo: Assembleia de Deus Rocha Eterna dos Remidos).
15. [x] Servidor: coluna nova "Responsável" (11ª coluna; na aba Excluidos vai no fim, 13ª),
        lista CONFIG.RESPONSAVEIS = Alex, Júlio, Gabriel, Lázaro; padrão Alex; migração automática
        do cabeçalho antigo; ícone do atalho = logo (setFaviconUrl com data URI, em try/catch).
16. [x] Interface: tema da igreja (laranja #FF8708, cinza rocha #504845, preto), cabeçalho com logo,
        campo Responsável (caixa com lista que filtra ao digitar), "por Alex" na lista.
17. [x] Tela 2: botões Exportar Excel e Exportar PDF (gerados no celular com SheetJS 0.18.5 e
        jsPDF 2.5.2 + autotable 3.8.4, carregados do jsDelivr/unpkg com SRI; nos testes, servidos
        de node_modules via page.route).
18. [x] Testes de interface + prints, publicar (npm run publicar), atualizar README.

## Estado atual
- **Última etapa concluída:** v3 publicada (versão 5 da implantação) — nome de quem contribuiu
- **Link do app:** https://script.google.com/macros/s/AKfycbyNetmj8y6NDe4qPv2zHcu2cWk1pBs93e5z5v_NZjdbhfjaC73F_CAcdH01RoxPCQWwVg/exec
- **Planilha:** https://docs.google.com/spreadsheets/d/1sYPLI4UyaGCvtKJIwI_OhJ3f08QFN0zPADB3qFVQIEg/edit
- **Conta dona (clasp/planilha):** vitor3457@gmail.com · scriptId em `.clasp.json` · implantação em `deploy.json`
- **Próximo passo exato:** etapa 11 — o dono abre o link do app, autoriza e faz um lançamento de teste
  (a aba `Lancamentos` é criada no 1º lançamento, renomeando a "Página1").
  Etapa 12 — com o e-mail do tesoureiro: trocar `PREENCHER_EMAIL_DO_TESOUREIRO@gmail.com` em
  `src/Config.js`, rodar `npm run publicar -- "Inclui tesoureiro"`, compartilhar a planilha com ele (Editor).

## Pendências que dependem do usuário
- Testar o app (etapa 11) e contar se deu certo.
- **E-mail Google do tesoureiro** (para a lista de autorizados e o compartilhamento da planilha).
- Daqui de dentro do container não dá para abrir script.google.com (proxy bloqueia) — o teste real é com o usuário.

### Como refazer o login do clasp numa sessão nova
Rodar em segundo plano um script Python que abre `node_modules/.bin/clasp login --no-localhost`
num pseudo-terminal (`pty.fork`), grava a saída num log e, quando existir um arquivo `url.txt`,
escreve o conteúdo + Enter no terminal. Mostrar ao usuário a URL de autorização do log;
quando ele colar a URL de retorno, gravá-la em `url.txt`. Conferir com `npx clasp show-authorized-user`.

## Registro
- Etapa 1: criados CLAUDE.md, PROGRESS.md, .gitignore.
- Etapa 2: package.json (clasp 3.4.1 como dependência de dev; scripts test/preview/test:ui/push/publicar),
  src/appsscript.json (fuso São Paulo, web app USER_ACCESSING + ANYONE), src/Config.js.
- Etapa 3: src/Codigo.js (doGet, acesso por lista de e-mails, aba criada com cabeçalho/formatos,
  salvar com LockService + anti-duplicação por ID, listar mês com totais em centavos,
  excluir com cópia na aba Excluidos) e src/AcessoNegado.html.
- Etapa 4: dev/gas-mock.js (simulação do Apps Script) e dev/testes-servidor.js — 28 testes passando (`npm test`).
- Etapas 5–7: src/Index.html, src/Estilos.html, src/Script.html (Tela 1 e Tela 2 numa página só,
  máscara R$ com números entrando pela direita, botões grandes, confirmação de exclusão,
  botão "voltar" do Android via google.script.history). dev/gerar-preview.js gera dev/preview.html
  com o servidor rodando sobre a simulação; dev/testes-ui.js — 14 testes no Chromium (Pixel 7 e 360px),
  prints em dev/prints/ (não versionados).
- Etapa 8: README.md (primeiro acesso, instalar no Android, uso, adicionar/remover usuário,
  liberar 2027, problemas comuns, colunas para o dashboard). dev/publicar.js (push + atualiza a
  mesma implantação; antes confere se o código online foi editado no site e para se foi).
- Etapas 9–10: API ativada e clasp login feitos pelo usuário (conta vitor3457@gmail.com).
  `clasp create --type sheets` criou planilha + script vinculado; `.clasp.json` (rootDir src),
  Config.js com PLANILHA_ID e e-mail do dono; `npm run publicar` criou a implantação (deploy.json).
  Obs.: existe também a implantação @HEAD criada automaticamente pelo Google — não usar.
- Correção: 1º acesso deu "A metatag especificada não é permitida" (apple-mobile-web-app-title não é aceita
  pelo HtmlService). Removida; cada meta tag agora fica em try/catch. publicar.js passou a comparar a
  versão online com os hashes do que foi publicado por último (deploy.json → arquivosPublicados).
- v2 (versão 4): logo + "ADRER", tema laranja/rocha/preto, campo Responsável (combobox: ao tocar
  esvazia e mostra a lista; digitar filtra sem acento; sair sem escolher mantém o anterior),
  exportar Excel (SheetJS) e PDF (jsPDF + autotable) gerados no celular. 31 testes de servidor e
  21 de interface (inclui download dentro de iframe com sandbox e o caso sem internet).
  Pendente com o usuário: confirmar no celular que abre, salva e exporta; e-mail do tesoureiro.
- v3 (versão 5): na Entrada, campo "Nome de quem contribuiu" (obrigatório no Dízimo, opcional na
  Oferta), gravado na coluna Descrição. Sugestões em botõezinhos para despesas e nomes (mais usados
  primeiro, filtram ao digitar; nome novo vira sugestão logo após salvar). Servidor: obterSugestoes()
  (obterSugestoesDespesa mantida por compatibilidade). 32 testes de servidor e 23 de interface.
- Versão 6: Gabriel removido de CONFIG.RESPONSAVEIS (agora Alex, Júlio, Lázaro). Lançamentos antigos com Gabriel continuam como estão.
- v4 (versão 7): menu fixo embaixo (Novo lançamento / Lançamentos / Dashboard; botões "Voltar" e
  "Ver lançamentos" removidos). Dashboard usa o mesmo filtro de mês: quadros (entradas, saídas,
  saldo, quantidade) e 3 gráficos SVG feitos à mão (barras dízimos/ofertas/saídas, linha do saldo
  acumulado com toque para ver o dia, maiores despesas). PDF do dashboard: gráficos convertidos
  SVG→PNG (canvas) e colocados no jsPDF. 32 testes de servidor e 26 de interface.

## Próxima fase: migração para Expo + Supabase — PREPARAÇÃO (não programar sem aval)
- Tudo recebido está em **MIGRACAO.md** (URL/chave pública do Supabase, usuário Expo, login Google,
  extras aprovados, importar planilha = sim, saldo acumulado entre meses).
- Pendências do usuário: e-mail do tesoureiro; saldo de abertura do caixa; aval para começar (ele troca o modelo).
