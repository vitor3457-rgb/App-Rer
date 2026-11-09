/**
 * Testes do servidor (src/Codigo.js) usando a simulação do Google (dev/gas-mock.js).
 * Rodar: npm test
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var RAIZ = path.join(__dirname, '..', 'src');
var DONO = 'dono@gmail.com';
var TESOUREIRO = 'tesoureiro@gmail.com';

/** Carrega Config.js + Codigo.js num "Apps Script" simulado. */
function novoApp(opcoes) {
  opcoes = opcoes || {};
  // A simulação roda dentro do mesmo "mundo" do código (como no Google),
  // assim objetos Date criados por ela e pelo app são do mesmo tipo.
  var contexto = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'gas-mock.js'), 'utf8'), contexto, { filename: 'gas-mock.js' });
  var gas = contexto.criarAmbienteGAS({
    email: opcoes.email === undefined ? DONO : opcoes.email,
    metasPermitidas: opcoes.metasPermitidas,
    lerArquivo: function (nome) { return fs.readFileSync(path.join(RAIZ, nome + '.html'), 'utf8'); },
  });
  ['SpreadsheetApp', 'LockService', 'Session', 'Utilities', 'HtmlService', 'console'].forEach(function (nome) {
    contexto[nome] = gas[nome];
  });
  ['Config.js', 'Logo.js', 'Codigo.js'].forEach(function (arquivo) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8'), contexto, { filename: arquivo });
  });
  contexto.CONFIG.USUARIOS_AUTORIZADOS = [DONO, 'Tesoureiro@Gmail.com '];
  contexto.CONFIG.PLANILHA_ID = opcoes.planilhaId || '';
  /** Simula a ida e volta pela internet (google.script.run usa JSON). */
  contexto.chamar = function (nome) {
    var args = [].slice.call(arguments, 1).map(function (a) { return JSON.parse(JSON.stringify(a)); });
    var r = contexto[nome].apply(null, args);
    return JSON.parse(JSON.stringify(r));
  };
  return { app: contexto, gas: gas };
}

function lancamento(extra) {
  var base = { valorCentavos: 5000, tipo: 'Entrada', categoria: 'Dízimo', descricao: 'Silvana', dataReferencia: '2026-11-08', responsavel: 'Alex' };
  Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
  return base;
}

function ehData(v) { return Object.prototype.toString.call(v) === '[object Date]'; }

var testes = [];
function teste(nome, fn) { testes.push({ nome: nome, fn: fn }); }

// ------------------------------------------------------------

teste('primeiro lançamento cria a aba "Lancamentos" com o cabeçalho certo', function () {
  var t = novoApp();
  var r = t.app.chamar('salvarLancamento', lancamento());
  assert.strictEqual(r.ok, true, r.erro);
  var ss = t.gas._planilha;
  assert.strictEqual(ss.getSheets().length, 1, 'deve reaproveitar a Página1 vazia');
  var aba = ss.getSheetByName('Lancamentos');
  assert.ok(aba, 'aba criada');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(aba.getRange(1, 1, 1, 11).getValues()[0])), [
    'ID', 'Data/hora do lançamento', 'Data de referência', 'Ano', 'Mês',
    'Tipo', 'Categoria', 'Descrição', 'Valor', 'Usuário', 'Responsável',
  ]);
  assert.strictEqual(aba.getFrozenRows(), 1);
  assert.strictEqual(ss.getSpreadsheetTimeZone(), 'America/Sao_Paulo');
  assert.strictEqual(ss.getSpreadsheetLocale(), 'pt_BR');
});

teste('grava uma linha limpa com os tipos certos em cada coluna', function () {
  var t = novoApp();
  var r = t.app.chamar('salvarLancamento', lancamento({ valorCentavos: 12345, id: 'abc12345-0000' }));
  assert.strictEqual(r.ok, true, r.erro);
  var aba = t.gas._planilha.getSheetByName('Lancamentos');
  assert.strictEqual(aba.getLastRow(), 2);
  var l = aba.getRange(2, 1, 1, 11).getValues()[0];
  assert.strictEqual(l[10], 'Alex');
  assert.strictEqual(l[0], 'abc12345-0000');
  assert.ok(ehData(l[1]), 'data/hora é data');
  assert.ok(ehData(l[2]), 'data de referência é data');
  var U = t.gas.Utilities;
  assert.strictEqual(U.formatDate(l[2], 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm'), '2026-11-08 00:00');
  assert.strictEqual(l[3], 2026);
  assert.strictEqual(l[4], 11);
  assert.strictEqual(l[5], 'Entrada');
  assert.strictEqual(l[6], 'Dízimo');
  assert.strictEqual(l[7], 'Silvana', 'na entrada, Descrição = nome de quem contribuiu');
  assert.strictEqual(l[8], 123.45);
  assert.strictEqual(l[9], DONO);
  assert.strictEqual(aba.getRange(2, 9).getNumberFormat(), '"R$" #,##0.00');
  assert.strictEqual(aba.getRange(2, 3).getNumberFormat(), 'dd/mm/yyyy');
});

teste('saída grava categoria "Despesa" e a descrição', function () {
  var t = novoApp({ email: TESOUREIRO });
  var r = t.app.chamar('salvarLancamento', lancamento({
    tipo: 'Saída', categoria: 'qualquer', descricao: '  Conta   de luz ', valorCentavos: 9990,
  }));
  assert.strictEqual(r.ok, true, r.erro);
  var l = t.gas._planilha.getSheetByName('Lancamentos').getRange(2, 1, 1, 10).getValues()[0];
  assert.strictEqual(l[5], 'Saída');
  assert.strictEqual(l[6], 'Despesa');
  assert.strictEqual(l[7], 'Conta de luz');
  assert.strictEqual(l[8], 99.9);
  assert.strictEqual(l[9], TESOUREIRO, 'e-mail fica em minúsculas');
});

teste('descrição que começa com "=" não vira fórmula', function () {
  var t = novoApp();
  var r = t.app.chamar('salvarLancamento', lancamento({ tipo: 'Saída', descricao: '=1+1' }));
  assert.strictEqual(r.ok, true, r.erro);
  var l = t.gas._planilha.getSheetByName('Lancamentos').getRange(2, 1, 1, 10).getValues()[0];
  assert.strictEqual(l[7], '=1+1');
});

teste('validações com mensagens claras em português', function () {
  var t = novoApp();
  var casos = [
    [lancamento({ valorCentavos: 0 }), /Digite o valor/],
    [lancamento({ valorCentavos: -100 }), /Digite o valor/],
    [lancamento({ valorCentavos: 'abc' }), /Digite o valor/],
    [lancamento({ valorCentavos: 10.5 }), /2 casas decimais/],
    [lancamento({ valorCentavos: 100000001 }), /Valor muito alto/],
    [lancamento({ tipo: '' }), /Entrada ou Saída/],
    [lancamento({ tipo: 'Transferência' }), /Entrada ou Saída/],
    [lancamento({ categoria: '' }), /Dízimo ou Oferta/],
    [lancamento({ categoria: 'Doação' }), /Dízimo ou Oferta/],
    [lancamento({ tipo: 'Saída', descricao: '   ' }), /descrição da despesa/],
    [lancamento({ tipo: 'Saída', descricao: new Array(202).join('x') }), /muito longa/],
    [lancamento({ dataReferencia: '' }), /Escolha a data/],
    [lancamento({ dataReferencia: '08/11/2026' }), /Escolha a data/],
    [lancamento({ dataReferencia: '2026-02-30' }), /não existe/],
    [lancamento({ dataReferencia: '2026-13-01' }), /não existe/],
    [lancamento({ dataReferencia: '2025-12-31' }), /precisa ser de 2026/],
    [lancamento({ dataReferencia: '2027-01-01' }), /precisa ser de 2026/],
    [lancamento({ id: '<script>' }), /Identificador/],
    [null, /Não recebi os dados/],
    [lancamento({ descricao: '  ' }), /nome de quem deu o dízimo/],
    [lancamento({ descricao: new Array(202).join('x') }), /O nome está muito longo/],
    [lancamento({ responsavel: '' }), /responsável na lista \(Alex, Júlio ou Lázaro\)/],
    [lancamento({ responsavel: 'Pedro' }), /responsável na lista/],
  ];
  casos.forEach(function (c) {
    var r = t.app.chamar('salvarLancamento', c[0]);
    assert.strictEqual(r.ok, false, 'deveria falhar: ' + JSON.stringify(c[0]));
    assert.ok(c[1].test(r.erro), 'mensagem "' + r.erro + '" deveria conter ' + c[1]);
  });
  var aba = t.gas._planilha.getSheetByName('Lancamentos');
  assert.ok(!aba || aba.getLastRow() <= 1, 'nada gravado');
});

teste('aceita "Saida"/"entrada"/"dizimo" sem acento ou em minúsculas', function () {
  var t = novoApp();
  assert.strictEqual(t.app.chamar('salvarLancamento', lancamento({ tipo: 'entrada', categoria: 'dizimo' })).ok, true);
  assert.strictEqual(t.app.chamar('salvarLancamento', lancamento({ tipo: 'Saida', descricao: 'Água' })).ok, true);
  var linhas = t.gas._planilha.getSheetByName('Lancamentos')._valores();
  assert.strictEqual(linhas[1][5], 'Entrada');
  assert.strictEqual(linhas[1][6], 'Dízimo');
  assert.strictEqual(linhas[2][5], 'Saída');
});

teste('responsável: aceita sem acento/maiúscula e grava o nome como está na lista', function () {
  var t = novoApp();
  var r = t.app.chamar('salvarLancamento', lancamento({ responsavel: '  lazaro ' }));
  assert.strictEqual(r.ok, true, r.erro);
  var lista = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(lista.itens[0].responsavel, 'Lázaro');
  assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(lista.itens[0].dataHoraISO), lista.itens[0].dataHoraISO);
});

teste('planilha antiga (10 colunas) ganha a coluna "Responsável" sem perder dados', function () {
  var t = novoApp();
  var ss = t.gas._planilha;
  var aba = ss.getSheets()[0].setName('Lancamentos');
  aba.getRange(1, 1, 1, 10).setValues([['ID', 'Data/hora do lançamento', 'Data de referência', 'Ano', 'Mês',
    'Tipo', 'Categoria', 'Descrição', 'Valor', 'Usuário']]);
  aba.getRange(2, 1, 1, 10).setValues([['antigo-0001', new Date(), new Date(2026, 10, 2), 2026, 11,
    'Entrada', 'Oferta', '', 10, 'dono@gmail.com']]);
  var r = t.app.chamar('salvarLancamento', lancamento({ responsavel: 'Júlio' }));
  assert.strictEqual(r.ok, true, r.erro);
  assert.strictEqual(aba.getRange(1, 11).getValue(), 'Responsável');
  assert.strictEqual(aba.getRange(3, 11).getValue(), 'Júlio');
  var lista = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(lista.itens.length, 2);
  var antigo = lista.itens.filter(function (i) { return i.id === 'antigo-0001'; })[0];
  assert.strictEqual(antigo.responsavel, '');

  // aba de excluídos antiga (12 colunas) também ganha a coluna nova no fim
  var exc = ss.insertSheet('Excluidos');
  exc.getRange(1, 1, 1, 12).setValues([['ID', 'Data/hora do lançamento', 'Data de referência', 'Ano', 'Mês',
    'Tipo', 'Categoria', 'Descrição', 'Valor', 'Usuário', 'Excluído em', 'Excluído por']]);
  assert.strictEqual(t.app.chamar('excluirLancamento', r.id).ok, true);
  assert.strictEqual(exc.getRange(1, 13).getValue(), 'Responsável');
  assert.strictEqual(exc.getRange(2, 13).getValue(), 'Júlio');
});

teste('ano extra em CONFIG.ANOS passa a ser aceito (preparado para 2027)', function () {
  var t = novoApp();
  t.app.CONFIG.ANOS = [2026, 2027];
  var r = t.app.chamar('salvarLancamento', lancamento({ dataReferencia: '2027-01-15' }));
  assert.strictEqual(r.ok, true, r.erro);
  var l = t.app.chamar('listarLancamentos', 2027, 1);
  assert.strictEqual(l.ok, true, l.erro);
  assert.strictEqual(l.itens.length, 1);
  var r2 = t.app.chamar('salvarLancamento', lancamento({ dataReferencia: '2028-01-15' }));
  assert.ok(/2026 ou 2027/.test(r2.erro), r2.erro);
});

teste('usuário não autorizado não grava, não lista e não exclui', function () {
  var t = novoApp({ email: 'intruso@gmail.com' });
  ['salvarLancamento', 'listarLancamentos', 'excluirLancamento', 'obterSugestoes'].forEach(function (f) {
    var r = t.app.chamar(f, f === 'listarLancamentos' ? 2026 : lancamento(), 11);
    assert.strictEqual(r.ok, false, f);
    assert.ok(/intruso@gmail.com não está autorizado/.test(r.erro), r.erro);
  });
  var vazio = novoApp({ email: '' });
  var r = vazio.app.chamar('salvarLancamento', lancamento());
  assert.ok(/não identificado/.test(r.erro), r.erro);
});

teste('doGet: autorizado vê o app; não autorizado vê "Acesso não autorizado"', function () {
  var t = novoApp();
  var pagina = t.app.doGet({});
  assert.strictEqual(pagina.arquivo, 'Index');
  assert.strictEqual(pagina.titulo, 'ADRER');
  assert.ok(/^data:image\/png;base64,/.test(pagina.template.logoCabecalho));
  assert.ok(/^data:image\/png;base64,/.test(pagina.favicon));
  assert.ok(pagina.metas.viewport);
  var dados = JSON.parse(pagina.template.dadosJson);
  assert.strictEqual(dados.email, DONO);
  assert.deepStrictEqual(dados.anos, [2026]);
  assert.strictEqual(dados.meses.length, 12);
  assert.deepStrictEqual(dados.responsaveis, ['Alex', 'Júlio', 'Lázaro']);
  assert.strictEqual(dados.responsavelPadrao, 'Alex');
  assert.strictEqual(dados.nomeCompleto, 'Assembleia de Deus Rocha Eterna dos Remidos');
  assert.ok(/^data:image\/png;base64,/.test(dados.logoPdf));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dados.hoje));

  var outro = novoApp({ email: 'Intruso@Gmail.com' });
  var negado = outro.app.doGet({});
  assert.strictEqual(negado.arquivo, 'AcessoNegado');
  assert.strictEqual(negado.template.email, 'intruso@gmail.com');
});

teste('doGet abre mesmo se o Google recusar uma meta tag opcional', function () {
  var t = novoApp({ metasPermitidas: ['viewport'] });
  var pagina = t.app.doGet({});
  assert.strictEqual(pagina.arquivo, 'Index');
  assert.ok(pagina.metas.viewport);
});

teste('JSON da página não permite fechar a tag <script>', function () {
  var t = novoApp();
  t.app.CONFIG.NOME_APP = '</script><b>x</b>&';
  var pagina = t.app.doGet({});
  assert.ok(pagina.template.dadosJson.indexOf('</script>') === -1);
  assert.strictEqual(JSON.parse(pagina.template.dadosJson).nomeApp, '</script><b>x</b>&');
});

teste('mesmo ID enviado duas vezes não duplica (internet caiu e tocou Salvar de novo)', function () {
  var t = novoApp();
  var d = lancamento({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
  var r1 = t.app.chamar('salvarLancamento', d);
  var r2 = t.app.chamar('salvarLancamento', d);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.duplicado, false);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.duplicado, true);
  assert.strictEqual(t.gas._planilha.getSheetByName('Lancamentos').getLastRow(), 2);
});

teste('sem ID, o servidor gera um', function () {
  var t = novoApp();
  var r = t.app.chamar('salvarLancamento', lancamento({ id: '' }));
  assert.strictEqual(r.ok, true);
  assert.ok(/^[0-9a-f-]{36}$/.test(r.id), r.id);
});

teste('usa a trava (LockService) e a libera depois de gravar e de excluir', function () {
  var t = novoApp();
  var r = t.app.chamar('salvarLancamento', lancamento());
  assert.strictEqual(t.gas._estado.travasPegas, 1);
  assert.strictEqual(t.gas._estado.travaOcupada, false, 'trava liberada');
  t.app.chamar('excluirLancamento', r.id);
  assert.strictEqual(t.gas._estado.travasPegas, 2);
  assert.strictEqual(t.gas._estado.travaOcupada, false, 'trava liberada');
});

teste('se a trava estiver ocupada (outra pessoa gravando), avisa sem gravar', function () {
  var t = novoApp();
  t.gas._estado.travaOcupada = true;
  var r = t.app.chamar('salvarLancamento', lancamento());
  assert.strictEqual(r.ok, false);
  assert.ok(/ocupado/.test(r.erro), r.erro);
});

teste('trava é liberada mesmo se der erro no meio da gravação', function () {
  var t = novoApp();
  t.app.chamar('salvarLancamento', lancamento());
  var aba = t.gas._planilha.getSheetByName('Lancamentos');
  aba.getRange(1, 9).setValue('Preço'); // alguém mexeu no cabeçalho
  var r = t.app.chamar('salvarLancamento', lancamento());
  assert.strictEqual(r.ok, false);
  assert.ok(/cabeçalho/.test(r.erro), r.erro);
  assert.strictEqual(t.gas._estado.travaOcupada, false);
});

teste('dois usuários alternando gravações: todas as linhas ficam na planilha', function () {
  var t = novoApp();
  for (var i = 1; i <= 30; i++) {
    t.gas._definirEmail(i % 2 ? DONO : TESOUREIRO);
    var r = t.app.chamar('salvarLancamento', lancamento({ valorCentavos: i * 100 }));
    assert.strictEqual(r.ok, true, r.erro);
  }
  var linhas = t.gas._planilha.getSheetByName('Lancamentos')._valores();
  assert.strictEqual(linhas.length, 31);
  var ids = {};
  linhas.slice(1).forEach(function (l) { ids[l[0]] = true; });
  assert.strictEqual(Object.keys(ids).length, 30, 'IDs únicos');
});

teste('cresce a planilha quando acabam as linhas da grade', function () {
  var t = novoApp();
  t.app.chamar('salvarLancamento', lancamento());
  var aba = t.gas._planilha.getSheetByName('Lancamentos');
  aba._maxLinhas = 3;
  for (var i = 0; i < 5; i++) assert.strictEqual(t.app.chamar('salvarLancamento', lancamento()).ok, true);
  assert.strictEqual(aba.getLastRow(), 7);
});

teste('lista só o mês pedido, mais recentes primeiro, com totais certos', function () {
  var t = novoApp();
  var s = function (d) { var r = t.app.chamar('salvarLancamento', lancamento(d)); assert.ok(r.ok, r.erro); return r; };
  s({ dataReferencia: '2026-11-01', categoria: 'Dízimo', valorCentavos: 10010 });
  s({ dataReferencia: '2026-11-15', categoria: 'Oferta', valorCentavos: 2050 });
  s({ dataReferencia: '2026-11-15', categoria: 'Dízimo', valorCentavos: 20000 });
  s({ dataReferencia: '2026-11-30', tipo: 'Saída', descricao: 'Aluguel', valorCentavos: 15000 });
  s({ dataReferencia: '2026-10-31', categoria: 'Oferta', valorCentavos: 99999 });
  s({ dataReferencia: '2026-12-01', tipo: 'Saída', descricao: 'Luz', valorCentavos: 99999 });

  var r = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(r.ok, true, r.erro);
  assert.strictEqual(r.nomeMes, 'Novembro');
  assert.strictEqual(r.itens.length, 4);
  assert.deepStrictEqual(r.itens.map(function (i) { return i.dataReferencia; }),
    ['2026-11-30', '2026-11-15', '2026-11-15', '2026-11-01']);
  assert.strictEqual(r.itens[0].descricao, 'Aluguel');
  assert.strictEqual(r.itens[0].tipo, 'Saída');
  assert.strictEqual(r.itens[0].usuario, DONO);
  assert.deepStrictEqual(r.totais, {
    dizimos: 30010, ofertas: 2050, entradas: 32060, saidas: 15000, saldo: 17060, quantidade: 4,
  });
  // aceita mês/ano em texto (vindo de um <select>)
  assert.strictEqual(t.app.chamar('listarLancamentos', '2026', '11').itens.length, 4);
});

teste('soma de centavos sem erro de arredondamento (0,10 + 0,20)', function () {
  var t = novoApp();
  t.app.chamar('salvarLancamento', lancamento({ valorCentavos: 10 }));
  t.app.chamar('salvarLancamento', lancamento({ valorCentavos: 20 }));
  var r = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(r.totais.entradas, 30);
});

teste('saldo negativo quando as saídas passam as entradas', function () {
  var t = novoApp();
  t.app.chamar('salvarLancamento', lancamento({ valorCentavos: 1000 }));
  t.app.chamar('salvarLancamento', lancamento({ tipo: 'Saída', descricao: 'Água', valorCentavos: 2500 }));
  var r = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(r.totais.saldo, -1500);
});

teste('lista vazia quando ainda não há aba/lançamentos', function () {
  var t = novoApp();
  var r = t.app.chamar('listarLancamentos', 2026, 3);
  assert.strictEqual(r.ok, true, r.erro);
  assert.strictEqual(r.itens.length, 0);
  assert.strictEqual(r.totais.saldo, 0);
});

teste('listar rejeita mês/ano inválidos', function () {
  var t = novoApp();
  assert.ok(/Mês inválido/.test(t.app.chamar('listarLancamentos', 2026, 13).erro));
  assert.ok(/Mês inválido/.test(t.app.chamar('listarLancamentos', 2026, 0).erro));
  assert.ok(/não está disponível/.test(t.app.chamar('listarLancamentos', 2025, 1).erro));
});

teste('lê também linhas digitadas à mão na planilha (texto, sem acento, data dd/mm/aaaa)', function () {
  var t = novoApp();
  t.app.chamar('salvarLancamento', lancamento());
  var aba = t.gas._planilha.getSheetByName('Lancamentos');
  aba.appendRow(['manual-0001', '', '05/11/2026', '', '', 'saida', 'Despesa', 'Gás', '1.234,50', '']);
  aba.appendRow(['', '', '', '', '', '', '', '', '', '']); // linha vazia é ignorada
  var r = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(r.itens.length, 2);
  var manual = r.itens.filter(function (i) { return i.id === 'manual-0001'; })[0];
  assert.strictEqual(manual.tipo, 'Saída');
  assert.strictEqual(manual.valorCentavos, 123450);
  assert.strictEqual(manual.dataReferencia, '2026-11-05');
});

teste('excluir remove da lista e guarda cópia na aba "Excluidos"', function () {
  var t = novoApp();
  var a = t.app.chamar('salvarLancamento', lancamento({ valorCentavos: 1111 }));
  var b = t.app.chamar('salvarLancamento', lancamento({ valorCentavos: 2222 }));
  t.gas._definirEmail(TESOUREIRO);
  var r = t.app.chamar('excluirLancamento', a.id);
  assert.strictEqual(r.ok, true, r.erro);

  var lista = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(lista.itens.length, 1);
  assert.strictEqual(lista.itens[0].id, b.id);

  var exc = t.gas._planilha.getSheetByName('Excluidos')._valores();
  assert.strictEqual(exc[0].length, 13);
  assert.strictEqual(exc[0][10], 'Excluído em');
  assert.strictEqual(exc[0][12], 'Responsável');
  assert.strictEqual(exc[1][12], 'Alex');
  assert.strictEqual(exc[1][0], a.id);
  assert.strictEqual(exc[1][8], 11.11);
  assert.ok(ehData(exc[1][10]));
  assert.strictEqual(exc[1][11], TESOUREIRO);
});

teste('excluir algo que já foi excluído avisa de forma clara', function () {
  var t = novoApp();
  var a = t.app.chamar('salvarLancamento', lancamento());
  assert.strictEqual(t.app.chamar('excluirLancamento', a.id).ok, true);
  var r = t.app.chamar('excluirLancamento', a.id);
  assert.strictEqual(r.ok, false);
  assert.ok(/não foi encontrado/.test(r.erro), r.erro);
  assert.ok(/não foi encontrado|inválido/.test(t.app.chamar('excluirLancamento', '').erro));
});

teste('oferta pode ficar sem nome; o nome é gravado na Descrição', function () {
  var t = novoApp();
  assert.strictEqual(t.app.chamar('salvarLancamento', lancamento({ categoria: 'Oferta', descricao: '' })).ok, true);
  assert.strictEqual(t.app.chamar('salvarLancamento', lancamento({ categoria: 'Oferta', descricao: ' Gabriel  Souza ' })).ok, true);
  var linhas = t.gas._planilha.getSheetByName('Lancamentos')._valores();
  assert.strictEqual(linhas[1][7], '');
  assert.strictEqual(linhas[2][7], 'Gabriel Souza');
});

teste('sugestões: despesas (Config + mais usadas) e nomes de quem contribuiu, sem repetir', function () {
  var t = novoApp();
  ['Gás', 'Gás', 'Gás', 'aluguel', 'Pintura'].forEach(function (d) {
    t.app.chamar('salvarLancamento', lancamento({ tipo: 'Saída', descricao: d }));
  });
  ['Silvana', 'silvana', 'Gabriel', 'Ana', 'Silvana', 'Gabriel'].forEach(function (n) {
    t.app.chamar('salvarLancamento', lancamento({ descricao: n }));
  });
  var r = t.app.chamar('obterSugestoes');
  assert.strictEqual(r.ok, true, r.erro);
  assert.deepStrictEqual(r.despesas, ['Aluguel', 'Água', 'Luz', 'Internet', 'Material de limpeza', 'Gás', 'Pintura']);
  assert.deepStrictEqual(r.contribuintes, ['Silvana', 'Gabriel', 'Ana']);
  var antiga = t.app.chamar('obterSugestoesDespesa');
  assert.strictEqual(antiga.sugestoes.length, 7);
});

teste('sem acesso à planilha: mensagem pedindo para compartilhar', function () {
  var t = novoApp({ planilhaId: 'PLANILHA_TESTE' });
  assert.strictEqual(t.app.chamar('salvarLancamento', lancamento()).ok, true, 'com acesso funciona');
  t.gas._estado.falharAberturaPlanilha = true;
  var r = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(r.ok, false);
  assert.ok(/compartilhar/.test(r.erro), r.erro);
});

teste('erro inesperado vira mensagem amigável (e é registrado no log)', function () {
  var t = novoApp();
  t.app.calcularTotais_ = null; // provoca um erro de programação
  var r = t.app.chamar('listarLancamentos', 2026, 11);
  assert.strictEqual(r.ok, false);
  assert.ok(/erro inesperado/.test(r.erro), r.erro);
  assert.ok(t.gas._registros.some(function (x) { return x[0] === 'error'; }));
});

// ------------------------------------------------------------
var falhas = 0;
testes.forEach(function (t) {
  try {
    t.fn();
    console.log('  ✔ ' + t.nome);
  } catch (e) {
    falhas++;
    console.log('  ✘ ' + t.nome + '\n      ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : e));
  }
});
console.log('\n' + (testes.length - falhas) + ' de ' + testes.length + ' testes passaram.');
process.exit(falhas ? 1 : 0);
