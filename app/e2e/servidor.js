// Servidor de arquivos simples para a versão web de teste (dist-demo), com retorno ao index.html.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
};

function iniciar(pasta, porta = 0) {
  const raiz = path.resolve(pasta);
  const servidor = http.createServer((req, res) => {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = path.join(raiz, caminho);
    if (!arquivo.startsWith(raiz) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      arquivo = path.join(raiz, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(arquivo).pipe(res);
  });
  return new Promise((resolve) => servidor.listen(porta, '127.0.0.1', () => resolve({ servidor, url: 'http://127.0.0.1:' + servidor.address().port })));
}

module.exports = { iniciar };
if (require.main === module) iniciar(process.argv[2] || 'dist-demo', Number(process.argv[3] || 8091)).then((s) => console.log(s.url));
