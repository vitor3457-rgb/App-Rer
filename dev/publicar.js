/**
 * Publica o app: envia o código (clasp push) e atualiza a MESMA implantação,
 * para o link do app nunca mudar. Na primeira vez, cria a implantação e
 * guarda o ID em deploy.json.
 *
 * Rodar: npm run publicar            (ou: npm run publicar -- "descrição da versão")
 * Requer: clasp login feito e .clasp.json presente.
 */
'use strict';
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var RAIZ = path.join(__dirname, '..');
var ARQUIVO_DEPLOY = path.join(RAIZ, 'deploy.json');

var CLASP = path.join(RAIZ, 'node_modules', '.bin', 'clasp');
var FORCAR = process.argv.indexOf('--forcar') >= 0;

function clasp(args, pasta) {
  return childProcess.execFileSync(CLASP, args, {
    cwd: pasta || RAIZ,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/**
 * Proteção: se alguém editou o código direto no site do Apps Script (ex.: para
 * incluir um e-mail), o push apagaria essa mudança. Então, antes de enviar,
 * baixamos a versão online e comparamos com a pasta src/.
 */
function conferirAlteracoesOnline() {
  var scriptId = JSON.parse(fs.readFileSync(path.join(RAIZ, '.clasp.json'), 'utf8')).scriptId;
  var tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'clasp-conferir-'));
  try {
    fs.writeFileSync(path.join(tmp, '.clasp.json'), JSON.stringify({ scriptId: scriptId, rootDir: '.' }));
    clasp(['pull'], tmp);
    var online = fs.readdirSync(tmp).filter(function (f) { return f !== '.clasp.json'; }).sort();
    var local = fs.readdirSync(path.join(RAIZ, 'src')).sort();
    var diferentes = [];
    online.concat(local).forEach(function (f) {
      if (diferentes.indexOf(f) >= 0) return;
      var a = path.join(tmp, f);
      var b = path.join(RAIZ, 'src', f);
      if (!fs.existsSync(a) || !fs.existsSync(b)) { diferentes.push(f); return; }
      var ta = fs.readFileSync(a, 'utf8');
      var tb = fs.readFileSync(b, 'utf8');
      var iguais = /\.json$/.test(f)
        ? JSON.stringify(JSON.parse(ta)) === JSON.stringify(JSON.parse(tb))
        : ta.replace(/\s+$/, '') === tb.replace(/\s+$/, '');
      if (!iguais) diferentes.push(f);
    });
    return { diferentes: diferentes, pasta: tmp };
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

function main() {
  if (!fs.existsSync(path.join(RAIZ, '.clasp.json'))) {
    throw new Error('Falta o .clasp.json (o projeto ainda não foi criado no Google). Veja o PROGRESS.md.');
  }
  var descricao = process.argv.slice(2).filter(function (a) { return a !== '--forcar'; })[0] ||
    ('Publicado em ' + new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  var config = fs.existsSync(ARQUIVO_DEPLOY) ? JSON.parse(fs.readFileSync(ARQUIVO_DEPLOY, 'utf8')) : {};

  // Na primeira publicação o projeto online ainda tem só o arquivo de exemplo do Google.
  if (config.deploymentId && !FORCAR) {
    console.log('0/2 Conferindo se alguém mudou o código direto no site do Google...');
    var c = conferirAlteracoesOnline();
    if (c.diferentes.length) {
      console.error('\nATENÇÃO: o código online é diferente do código local nestes arquivos: ' +
        c.diferentes.join(', ') + '.\nA versão online foi baixada em: ' + c.pasta +
        '\nCompare, traga para src/ as mudanças que devem ficar e rode de novo ' +
        '(ou use "npm run publicar -- --forcar" para sobrescrever a versão online).');
      process.exit(2);
    }
    fs.rmSync(c.pasta, { recursive: true, force: true });
  }

  console.log('1/2 Enviando o código para o Google (clasp push)...');
  process.stdout.write(clasp(['push', '--force']));
  var args = ['--json', 'deploy', '-d', descricao];
  if (config.deploymentId) args.push('-i', config.deploymentId);

  console.log('2/2 ' + (config.deploymentId ? 'Atualizando a implantação existente' : 'Criando a implantação') + '...');
  var saida = clasp(args);
  var json = JSON.parse(saida.slice(saida.indexOf('{')));
  if (!json.deploymentId) throw new Error('O clasp não devolveu o ID da implantação: ' + saida);

  config.deploymentId = json.deploymentId;
  config.url = 'https://script.google.com/macros/s/' + json.deploymentId + '/exec';
  config.ultimaVersao = json.versionNumber;
  config.ultimaPublicacao = new Date().toISOString();
  fs.writeFileSync(ARQUIVO_DEPLOY, JSON.stringify(config, null, 2) + '\n');

  console.log('\nPronto! Versão ' + json.versionNumber + ' publicada.');
  console.log('Link do app (não muda): ' + config.url);
}

try {
  main();
} catch (e) {
  console.error('\nErro ao publicar: ' + (e && e.message ? e.message : e));
  process.exit(1);
}
