# ADRER — Controle financeiro

**Assembleia de Deus Rocha Eterna dos Remidos**

App de celular para registrar **entradas** (dízimos e ofertas) e **saídas** (despesas) da igreja.
Tudo fica gravado numa planilha do Google, que depois pode virar um painel (Looker Studio / Power BI).

- **Link do app:** https://script.google.com/macros/s/AKfycbyNetmj8y6NDe4qPv2zHcu2cWk1pBs93e5z5v_NZjdbhfjaC73F_CAcdH01RoxPCQWwVg/exec
- **Link da planilha:** https://docs.google.com/spreadsheets/d/1sYPLI4UyaGCvtKJIwI_OhJ3f08QFN0zPADB3qFVQIEg/edit (conta dona: vitor3457@gmail.com)

Somente as contas Google autorizadas conseguem usar o app.

---

## 1. Primeiro acesso (cada pessoa faz uma vez)

1. No celular, abra o **link do app** no **Google Chrome**, já conectado à sua conta Google.
2. Na primeira vez, o Google pede autorização. Toque em **Revisar permissões** e escolha a sua conta.
3. Vai aparecer o aviso **"O Google não verificou este app"**. É normal: o app foi feito
   para uso interno da igreja e não passou pela verificação pública do Google.
   Toque em **Avançado** e depois em **Acessar** o app (aparece como "não seguro").
4. Toque em **Permitir**. O app permite:
   - ver o seu e-mail, para saber quem fez cada lançamento;
   - ler e gravar a planilha da igreja.
5. Pronto. O app abre na tela **Novo lançamento**.

## 2. Instalar na tela inicial do Android

1. Com o app aberto no **Chrome**, toque nos **três pontinhos ⋮** (canto superior direito).
2. Toque em **Adicionar à tela inicial**. Em alguns celulares, o nome é **Instalar app**.
3. Confirme o nome (ex.: "ADRER") e toque em **Adicionar**.
   Se o celular perguntar, toque em **Adicionar automaticamente** ou arraste o ícone para a tela.
4. A partir daí, é só tocar no ícone, como em qualquer outro app.

> No topo do app o Google mostra a frase "Este aplicativo foi criado por um usuário do
> Google Apps Script". É normal.

## 3. Como usar

### Novo lançamento (tela inicial)
1. **Responsável**: já vem com **Alex**. Para trocar, toque na caixa: aparece a lista
   (Alex, Júlio, Lázaro). Toque no nome, ou comece a digitar para filtrar
   (ex.: `laz` → Lázaro). O nome escolhido continua marcado nos próximos lançamentos
   até o app ser fechado.
1. **Valor**: digite só os números. Exemplo: para R$ 50,00, digite `5`, `0`, `0`, `0`.
2. Toque em **Entrada** ou **Saída**.
   - **Entrada**: escolha **Dízimo** ou **Oferta** e escreva o **nome de quem contribuiu**
     (obrigatório no dízimo, opcional na oferta). Os nomes já usados aparecem embaixo do campo:
     é só tocar no nome. Ao digitar (ex.: `sil`), aparecem só os nomes parecidos (ex.: Silvana).
   - **Saída**: escreva a **descrição da despesa** (ex.: aluguel, água, luz) ou toque numa sugestão.
3. **Data**: já vem com a data de hoje. Toque para mudar, se precisar.
4. Toque em **Salvar**. Aparece a mensagem **"Lançamento salvo!"** e o formulário fica limpo
   (o responsável continua escolhido).

### Lançamentos do mês
- Toque em **Ver lançamentos do mês**.
- Escolha o mês na lista ou use as setas **‹ ›**.
- Entradas aparecem em **verde** e saídas em **vermelho**.
- No final aparece o **resumo**: dízimos, ofertas, total de entradas, total de saídas e **saldo do mês**.
- **Excluir um lançamento errado**: toque na **lixeira** ao lado dele e confirme em **Sim, excluir**.
  O lançamento sai da lista, mas fica guardada uma cópia na aba **Excluidos** da planilha
  (com quem excluiu e quando).
- **Exportar o mês**: escolha o mês e toque em **Excel** ou **PDF** (em "Exportar este mês para").
  - **Excel**: baixa o arquivo `ADRER-lancamentos-AAAA-MM.xlsx` com todos os lançamentos do mês
    (mesmas colunas da planilha) e uma aba **Resumo** com os totais.
  - **PDF**: baixa o relatório `ADRER-relatorio-AAAA-MM.pdf` com o logo, os totais e a lista do mês.
  - O arquivo vai para a pasta **Downloads** do celular (aparece também na notificação).
  - Na primeira vez, o app baixa a ferramenta de exportação da internet. Se a internet estiver lenta,
    pode aparecer "Tudo pronto! Toque de novo em Exportar" — é só tocar de novo.
- Para voltar, toque em **Voltar** ou use o botão "voltar" do celular.

## 4. Adicionar ou remover um usuário autorizado

São duas coisas: a **lista de e-mails do app** e o **compartilhamento da planilha**.

**Jeito mais fácil:** abra uma sessão do Claude neste repositório e peça, por exemplo:
_"Adicione fulano@gmail.com como usuário autorizado"_. O Claude altera a lista e republica o app.
Você só precisa compartilhar a planilha (passo B abaixo).

**Para fazer você mesmo:**

**A) Lista de e-mails do app**
1. Abra a **planilha** no computador.
2. Menu **Extensões → Apps Script**.
3. À esquerda, abra o arquivo **Config.gs**.
4. Na lista `USUARIOS_AUTORIZADOS`, adicione o novo e-mail (ou apague a linha do e-mail a remover).
   Cada e-mail fica entre aspas simples e com vírgula no final, assim:
   ```
   USUARIOS_AUTORIZADOS: [
     'voce@gmail.com',
     'tesoureiro@gmail.com',
     'novapessoa@gmail.com',
   ],
   ```
5. Clique no ícone de **disquete (Salvar)**.
6. Clique em **Implantar → Gerenciar implantações**. Na implantação ativa, clique no **lápis (Editar)**.
   Em **Versão**, escolha **Nova versão** e clique em **Implantar**.
   (Assim o link do app continua o mesmo.)

**B) Compartilhamento da planilha**
- **Adicionar:** abra a planilha, clique em **Compartilhar**, digite o e-mail, deixe como **Editor** e clique em **Enviar**.
- **Remover:** em **Compartilhar**, ao lado do e-mail, troque **Editor** por **Remover acesso** e salve.

> Use o e-mail da **conta Google** com que a pessoa entra no celular.

## 4.1 Mudar a lista de responsáveis (Alex, Júlio, Lázaro)

Peça ao Claude (ex.: _"inclua a Maria na lista de responsáveis"_) ou siga o passo **4A**,
mas edite estas linhas do **Config.gs**:
```
RESPONSAVEIS: ['Alex', 'Júlio', 'Lázaro'],
RESPONSAVEL_PADRAO: 'Alex',
```
`RESPONSAVEL_PADRAO` é o nome que já vem escolhido quando o app abre.

## 5. Começo de 2027: liberar o novo ano

O app aceita lançamentos e mostra lançamentos só dos anos configurados (hoje: **2026**).
Antes de 1º de janeiro de 2027, peça ao Claude: _"Adicione o ano de 2027 no app"_.
Para fazer você mesmo, siga o passo **4A**, mas troque `ANOS: [2026],` por `ANOS: [2026, 2027],`.
Com mais de um ano, a tela **Lançamentos do mês** passa a mostrar também a escolha do ano.

## 6. Problemas comuns

| O que aparece | O que fazer |
|---|---|
| **"Não foi possível abrir o arquivo neste momento"** | Acontece quando há várias contas Google no Chrome. Saia das outras contas no Chrome ou abra o link numa janela anônima e entre só com a conta autorizada. |
| **"Acesso não autorizado"** | A conta usada não está na lista. Confira o e-mail mostrado na tela e veja a seção 4. |
| **"Você não tem acesso à planilha do app"** | A planilha não foi compartilhada com esse e-mail como **Editor** (seção 4B). |
| **"Sem conexão com a internet"** | Verifique o Wi-Fi ou os dados móveis e toque em **Salvar** de novo. O app não duplica o lançamento. |
| **"O sistema está ocupado..."** | A outra pessoa estava salvando ao mesmo tempo. Aguarde alguns segundos e tente de novo. |
| **"O cabeçalho da aba ... foi alterado"** | Alguém mudou a linha 1 da planilha. Volte os títulos das colunas ao original (seção 7). |

## 7. A planilha (para o painel / dashboard)

- Aba **`Lancamentos`**: uma linha por lançamento, cabeçalho na linha 1:

  | Coluna | Conteúdo |
  |---|---|
  | ID | código único do lançamento |
  | Data/hora do lançamento | quando foi registrado no app |
  | Data de referência | data escolhida no app |
  | Ano | ano da data de referência (ex.: 2026) |
  | Mês | mês da data de referência, em número (1 a 12) |
  | Tipo | `Entrada` ou `Saída` |
  | Categoria | `Dízimo`, `Oferta` ou `Despesa` |
  | Descrição | na **Saída**: o que foi a despesa; na **Entrada**: nome de quem contribuiu |
  | Valor | número positivo com 2 casas decimais |
  | Usuário | e-mail da conta Google usada no lançamento |
  | Responsável | pessoa escolhida no app (Alex, Júlio, Lázaro...) |

- Aba **`Excluidos`**: cópia dos lançamentos excluídos (não use no painel).
- **Não mude os títulos da linha 1** nem a ordem das colunas: o app confere isso antes de gravar.
- No Looker Studio: **Criar → Fonte de dados → Planilhas Google**, escolha a planilha e a aba
  **Lancamentos**, com "Usar a primeira linha como cabeçalho" marcado.

---

Detalhes técnicos (para quem for mexer no código): veja `CLAUDE.md` e `PROGRESS.md`.
