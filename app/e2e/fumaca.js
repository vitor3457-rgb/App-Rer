// Teste rápido: abre o app de demonstração, entra e tira prints.
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');
const { iniciar } = require('./servidor');

(async () => {
  const prints = path.join(__dirname, 'prints');
  fs.mkdirSync(prints, { recursive: true });
  const { servidor, url } = await iniciar(path.join(__dirname, '..', 'dist-demo'));
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ ...devices['Pixel 7'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await contexto.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await p.clock.setFixedTime(new Date('2026-11-14T15:00:00-03:00'));
  await p.goto(url);
  await p.waitForSelector('[data-testid="tela-login"]', { timeout: 20000 }).catch(() => {});
  await p.screenshot({ path: path.join(prints, '00-login.png') });
  if (await p.locator('[data-testid="entrar-google"]').count()) {
    await p.click('[data-testid="entrar-google"]');
    await p.waitForSelector('[data-testid="tela-novo"]', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(prints, '01-novo.png') });
  }
  console.log('erros:', JSON.stringify(erros.slice(0, 8), null, 1));
  console.log('texto:', (await p.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | '));
  await navegador.close();
  servidor.close();
})().catch((e) => { console.error(e); process.exit(1); });
