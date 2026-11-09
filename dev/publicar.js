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

/** Resumo (hash) de cada arquivo, ignorando espaços no fim e a formatação do JSON. */
function resumirPasta(pasta) {
  var crypto = require('crypto');
  var r = {};
  fs.readdirSync(pasta).filter(function (f) { return f !== '.clasp.json'; }).sort().forEach(function (f) {
    var t = fs.readFileSync(path.join(pasta, f), 'utf8');
    t = /\.json$/.test(f) ? JSON.stringify(JSON.parse(t)) : t.replace(/\s+$/, '');
    r[f] = crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
  });
  return r;
}

/**
 * Proteção: se alguém editou o código direto no site do Apps Script (ex.: para
 * incluir um e-mail), o push apagaria essa mudança. Então, antes de enviar,
 * baixamos a versão online e comparamos com o que foi enviado na última publicação.
 */
function conferirAlteracoesOnline(publicados) {
  var scriptId = JSON.parse(fs.readFileSync(path.join(RAIZ, '.clasp.json'), 'utf8')).scriptId;
  var tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'clasp-conferir-'));
  try {
    fs.writeFileSync(path.join(tmp, '.clasp.json'), JSON.stringify({ scriptId: scriptId, rootDir: '.' }));
    clasp(['pull'], tmp);
    var online = resumirPasta(tmp);
    var diferentes = Object.keys(online).concat(Object.keys(publicados)).filter(function (f, i, todos) {
      return todos.indexOf(f) === i && online[f] !== publicados[f];
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
  if (config.deploymentId && config.arquivosPublicados && !FORCAR) {
    console.log('0/2 Conferindo se alguém mudou o código direto no site do Google...');
    var c = conferirAlteracoesOnline(config.arquivosPublicados);
    if (c.diferentes.length) {
      console.error('\nATENÇÃO: o código online foi alterado depois da última publicação nestes arquivos: ' +
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
  config.arquivosPublicados = resumirPasta(path.join(RAIZ, 'src'));
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
