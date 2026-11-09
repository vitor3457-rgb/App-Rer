/**
 * Gera dev/preview.html: o app completo rodando no navegador, com o Google simulado.
 * O código do servidor (Config.js + Codigo.js) roda de verdade dentro da página,
 * sobre a simulação dev/gas-mock.js. Nada é enviado para o Google.
 *
 * Rodar: npm run preview   (depois abra dev/preview.html no navegador)
 * Opções na URL: ?email=x@gmail.com  &exemplos=1 (dados de exemplo)  &offline=1  &latencia=800
 */
'use strict';
var fs = require('fs');
var path = require('path');

var SRC = path.join(__dirname, '..', 'src');
function ler(arquivo) { return fs.readFileSync(arquivo, 'utf8'); }
function semScript(texto) { return texto.replace(/<\/script/gi, '<\\/script'); }

var simulacao = [
  '<script>' + semScript(ler(path.join(__dirname, 'gas-mock.js'))) + '</script>',
  '<script>' + semScript(ler(path.join(SRC, 'Config.js'))) + '</script>',
  '<script>' + semScript(ler(path.join(SRC, 'Logo.js'))) + '</script>',
  '<script>' + semScript(ler(path.join(SRC, 'Codigo.js'))) + '</script>',
  '<script>',
  '(function () {',
  '  var p = new URLSearchParams(location.search);',
  '  var email = p.get("email") || window.__EMAIL || "dono@gmail.com";',
  '  var latencia = Number(p.get("latencia") || window.__LATENCIA || 400);',
  '  var gas = criarAmbienteGAS({ email: email });',
  '  window.__gas = gas;',
  '  window.SpreadsheetApp = gas.SpreadsheetApp;',
  '  window.LockService = gas.LockService;',
  '  window.Session = gas.Session;',
  '  window.Utilities = gas.Utilities;',
  '  window.HtmlService = gas.HtmlService;',
  '  CONFIG.USUARIOS_AUTORIZADOS = ["dono@gmail.com", "tesoureiro@gmail.com"];',
  '  CONFIG.PLANILHA_ID = ""; // na simulação, usa a planilha simulada',
  '  window.__offline = p.get("offline") === "1" || !!window.__OFFLINE;',
  '',
  '  // google.script.run simulado (assíncrono e com ida e volta em JSON, como o real)',
  '  function criarExecutor(sucesso, falha) {',
  '    return new Proxy({}, {',
  '      get: function (_, nome) {',
  '        if (nome === "withSuccessHandler") return function (f) { return criarExecutor(f, falha); };',
  '        if (nome === "withFailureHandler") return function (f) { return criarExecutor(sucesso, f); };',
  '        return function () {',
  '          var args = JSON.parse(JSON.stringify([].slice.call(arguments)));',
  '          setTimeout(function () {',
  '            if (window.__offline) { if (falha) falha(new Error("NetworkError: Connection failure due to HTTP 0")); return; }',
  '            if (/_$/.test(nome) || typeof window[nome] !== "function") {',
  '              if (falha) falha(new Error("Script function not found: " + nome)); return;',
  '            }',
  '            try {',
  '              var r = JSON.parse(JSON.stringify(window[nome].apply(null, args)));',
  '              if (sucesso) sucesso(r);',
  '            } catch (e) { if (falha) falha(e); }',
  '          }, latencia);',
  '        };',
  '      },',
  '    });',
  '  }',
  '  var handler = null;',
  '  window.addEventListener("popstate", function (e) { if (handler) handler({ state: e.state, location: {} }); });',
  '  window.google = { script: {',
  '    run: criarExecutor(null, null),',
  '    history: {',
  '      push: function (s, q, h) { history.pushState(s, "", "#" + (h || "")); },',
  '      replace: function (s, q, h) { history.replaceState(s, "", location.search + "#" + (h || "")); },',
  '      setChangeHandler: function (f) { handler = f; },',
  '    },',
  '  } };',
  '',
  '  if (p.get("exemplos") === "1" || window.__EXEMPLOS) {',
  '    var hoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM");',
  '    if (hoje.slice(0, 4) !== "2026") hoje = "2026-11";',
  '    [',
  '      ["01", 15000, "Entrada", "Dízimo", "Silvana"], ["01", 4520, "Entrada", "Oferta", ""],',
  '      ["03", 80000, "Saída", "Despesa", "Aluguel"], ["05", 12735, "Saída", "Despesa", "Conta de luz"],',
  '      ["08", 30000, "Entrada", "Dízimo", "Maria"], ["08", 6890, "Entrada", "Oferta", ""],',
  '      ["08", 9850, "Saída", "Despesa", "Material de limpeza e manutenção do banheiro"]',
  '    ].forEach(function (x, i) {',
  '      gas._definirEmail(i % 3 === 2 ? "tesoureiro@gmail.com" : "dono@gmail.com");',
  '      salvarLancamento({ valorCentavos: x[1], tipo: x[2], categoria: x[3], descricao: x[4], dataReferencia: hoje + "-" + x[0], responsavel: ["Alex", "Júlio", "Lázaro"][i % 3] });',
  '    });',
  '    gas._definirEmail(email);',
  '  }',
  '})();',
  '</script>',
].join('\n');

function gerar(destino) {
  var html = ler(path.join(SRC, 'Index.html'));
  var nomeApp = 'ADRER';
  var contexto = {};
  require('vm').runInNewContext(ler(path.join(SRC, 'Logo.js')), contexto);
  html = html
    .replace("<?!= incluir_('Estilos'); ?>", function () { return ler(path.join(SRC, 'Estilos.html')); })
    .replace("<?!= incluir_('Script'); ?>", function () { return ler(path.join(SRC, 'Script.html')); })
    .replace(/<\?= nomeApp \?>/g, nomeApp)
    .replace('<?!= logoCabecalho ?>', function () { return contexto.LOGO.cabecalho; })
    .replace('<?!= dadosJson ?>', 'dadosIniciais_(Session.getActiveUser().getEmail())')
    .replace('<head>', function () {
      return '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' +
        nomeApp + ' (pré-visualização)</title>\n' + simulacao;
    });
  if (/<\?/.test(html)) throw new Error('Sobrou um trecho de template sem tratar em Index.html');
  fs.writeFileSync(destino, html);
  return destino;
}

if (require.main === module) {
  var destino = gerar(path.join(__dirname, 'preview.html'));
  console.log('Pré-visualização gerada: ' + destino);
}
module.exports = { gerar: gerar };
