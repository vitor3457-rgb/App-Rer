/**
 * Testes da interface no Chromium, com tamanho de celular, usando dev/preview.html
 * (Google simulado). Também tira prints em dev/prints/ para conferência visual.
 * Rodar: npm run test:ui
 */
'use strict';
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var playwright = require('playwright');

var URL_PREVIEW = 'file://' + path.join(__dirname, 'preview.html');
var PRINTS = path.join(__dirname, 'prints');
fs.mkdirSync(PRINTS, { recursive: true });

var resultados = [];
async function passo(nome, fn) {
  try {
    await fn();
    resultados.push(true);
    console.log('  ✔ ' + nome);
  } catch (e) {
    resultados.push(false);
    console.log('  ✘ ' + nome + '\n      ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n      '));
  }
}

async function novaPagina(navegador, opcoes) {
  opcoes = opcoes || {};
  var contexto = await navegador.newContext(Object.assign(
    {}, opcoes.dispositivo || playwright.devices['Pixel 7'],
    { locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }
  ));
  var pagina = await contexto.newPage();
  pagina.__erros = [];
  pagina.on('pageerror', function (e) { pagina.__erros.push(e.message); });
  pagina.on('console', function (m) { if (m.type() === 'error') pagina.__erros.push(m.text()); });
  await pagina.goto(URL_PREVIEW + '?latencia=120' + (opcoes.exemplos ? '&exemplos=1' : ''));
  await pagina.waitForSelector('#botao-salvar');
  return pagina;
}

/** Esconde o aviso atual, para o próximo textoAviso() esperar por um aviso novo. */
async function limparAviso(p) {
  await p.evaluate(function () { document.getElementById('aviso').hidden = true; });
}

async function textoAviso(p) {
  await p.waitForSelector('#aviso:not([hidden])', { timeout: 5000 });
  return (await p.textContent('#aviso')).trim();
}

async function linhasPlanilha(p) {
  return p.evaluate(function () {
    var aba = window.__gas._planilha.getSheetByName('Lancamentos');
    return aba ? aba._valores().map(function (l) { return l.map(String); }) : [];
  });
}

async function digitarValor(p, digitos) {
  await p.click('#valor');
  await p.fill('#valor', '');
  await p.keyboard.type(digitos);
}

(async function () {
  var navegador = await playwright.chromium.launch();
  var p = await novaPagina(navegador);

  await passo('Tela 1 abre com data de hoje e sem erros', async function () {
    assert.strictEqual(await p.isVisible('#tela-novo'), true);
    assert.strictEqual(await p.isVisible('#tela-lista'), false);
    var hoje = await p.evaluate(function () {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    });
    assert.strictEqual(await p.inputValue('#data'), hoje);
    assert.ok((await p.textContent('#data-extenso')).length > 5);
    assert.strictEqual(await p.textContent('#email-usuario'), 'dono@gmail.com');
    assert.strictEqual(await p.getAttribute('#valor', 'inputmode'), 'numeric');
    await p.screenshot({ path: path.join(PRINTS, '1-tela-novo.png') });
  });

  await passo('máscara do valor: números entram pela direita, apagar remove o último', async function () {
    await digitarValor(p, '5');
    assert.strictEqual(await p.inputValue('#valor'), 'R$ 0,05');
    await p.keyboard.type('000');
    assert.strictEqual(await p.inputValue('#valor'), 'R$ 50,00');
    await digitarValor(p, '123456789');
    assert.strictEqual(await p.inputValue('#valor'), 'R$ 1.234.567,89');
    await p.keyboard.type('9'); // passa do limite de dígitos: ignora
    assert.strictEqual(await p.inputValue('#valor'), 'R$ 1.234.567,89');
    await p.keyboard.press('Backspace');
    assert.strictEqual(await p.inputValue('#valor'), 'R$ 123.456,78');
    await digitarValor(p, '1');
    await p.keyboard.press('Backspace');
    assert.strictEqual(await p.inputValue('#valor'), '');
    await p.keyboard.type('abc');
    assert.strictEqual(await p.inputValue('#valor'), '');
  });

  await passo('validações aparecem em português', async function () {
    await p.fill('#valor', '');
    await p.click('#botao-salvar');
    assert.ok(/Digite o valor/.test(await p.textContent('#erro-form')));
    await digitarValor(p, '5000');
    await p.click('#botao-salvar');
    assert.ok(/Entrada ou Saída/.test(await p.textContent('#erro-form')));
    await p.click('[data-tipo="Entrada"]');
    assert.strictEqual(await p.isVisible('#bloco-categoria'), true);
    assert.strictEqual(await p.isVisible('#bloco-descricao'), false);
    await p.click('#botao-salvar');
    assert.ok(/Dízimo ou Oferta/.test(await p.textContent('#erro-form')));
    await p.screenshot({ path: path.join(PRINTS, '2-erro-validacao.png') });
  });

  await passo('salva uma Entrada (Dízimo), mostra confirmação e limpa o formulário', async function () {
    await p.click('[data-categoria="Dízimo"]');
    assert.strictEqual(await p.getAttribute('[data-categoria="Dízimo"]', 'aria-pressed'), 'true');
    await limparAviso(p);
    await p.click('#botao-salvar');
    var aviso = await textoAviso(p);
    assert.ok(/Lançamento salvo!/.test(aviso), aviso);
    assert.ok(/Dízimo/.test(aviso) && /R\$ 50,00/.test(aviso), aviso);
    await p.screenshot({ path: path.join(PRINTS, '3-salvo.png') });
    assert.strictEqual(await p.inputValue('#valor'), '');
    assert.strictEqual(await p.getAttribute('[data-tipo="Entrada"]', 'aria-pressed'), 'false');
    assert.strictEqual(await p.isVisible('#bloco-categoria'), false);
    var linhas = await linhasPlanilha(p);
    assert.strictEqual(linhas.length, 2);
    assert.strictEqual(linhas[1][5], 'Entrada');
    assert.strictEqual(linhas[1][6], 'Dízimo');
    assert.strictEqual(linhas[1][8], '50');
  });

  await passo('Saída exige descrição; sugestão preenche o campo; salva', async function () {
    await digitarValor(p, '80000');
    await p.click('[data-tipo="Saída"]');
    assert.strictEqual(await p.isVisible('#bloco-descricao'), true);
    assert.strictEqual(await p.isVisible('#bloco-categoria'), false);
    await p.click('#botao-salvar');
    assert.ok(/descrição da despesa/.test(await p.textContent('#erro-form')));
    await p.screenshot({ path: path.join(PRINTS, '4-saida-sem-descricao.png') });
    await p.click('.sugestao >> text=Aluguel');
    assert.strictEqual(await p.inputValue('#descricao'), 'Aluguel');
    await limparAviso(p);
    await p.click('#botao-salvar');
    assert.ok(/Lançamento salvo!/.test(await textoAviso(p)));
    var linhas = await linhasPlanilha(p);
    assert.strictEqual(linhas.length, 3);
    assert.strictEqual(linhas[2][6], 'Despesa');
    assert.strictEqual(linhas[2][7], 'Aluguel');
  });

  await passo('data fora de 2026 é recusada com mensagem clara', async function () {
    await digitarValor(p, '100');
    await p.click('[data-tipo="Entrada"]');
    await p.click('[data-categoria="Oferta"]');
    await p.fill('#data', '2025-12-31');
    await p.click('#botao-salvar');
    assert.ok(/precisa ser de 2026/.test(await p.textContent('#erro-form')));
    var hoje = await p.evaluate(function () { return document.getElementById('data').min; });
    assert.strictEqual(hoje, '2026-01-01');
  });

  await passo('sem internet: mostra erro; ao voltar a internet, salva uma vez só', async function () {
    await p.fill('#data', '2026-11-02');
    await p.evaluate(function () { window.__offline = true; });
    await p.click('#botao-salvar');
    await p.waitForFunction(function () { return !document.getElementById('erro-form').hidden; });
    assert.ok(/Sem conexão/.test(await p.textContent('#erro-form')));
    assert.strictEqual(await p.isEnabled('#botao-salvar'), true);
    await p.evaluate(function () { window.__offline = false; });
    await limparAviso(p);
    await p.click('#botao-salvar');
    assert.ok(/Lançamento salvo!/.test(await textoAviso(p)));
    assert.strictEqual((await linhasPlanilha(p)).length, 4);
  });

  await passo('tocar duas vezes rápido em Salvar não duplica', async function () {
    await digitarValor(p, '2500');
    await p.click('[data-tipo="Entrada"]');
    await p.click('[data-categoria="Oferta"]');
    await limparAviso(p);
    await p.click('#botao-salvar');
    await p.click('#botao-salvar', { force: true });
    await textoAviso(p);
    await p.waitForTimeout(400);
    assert.strictEqual((await linhasPlanilha(p)).length, 5);
  });

  await passo('Tela 2 lista o mês com cores e totais corretos', async function () {
    await p.click('#ir-lista');
    assert.strictEqual(await p.isVisible('#tela-lista'), true);
    await p.waitForSelector('#resumo:not([hidden])');
    // Mês exibido = mês atual; os lançamentos de teste foram em datas variadas.
    await p.selectOption('#filtro-mes', '11');
    await p.waitForFunction(function () {
      return document.querySelectorAll('#lista .item').length === 4 && !document.getElementById('resumo').hidden;
    });
    assert.strictEqual(await p.isVisible('#ano-fixo'), true);
    assert.strictEqual(await p.textContent('#ano-fixo'), '2026');
    assert.strictEqual(await p.isVisible('#linha-ano'), false, 'com um ano só, não mostra a escolha de ano');
    var mesCabe = await p.$eval('#filtro-mes', function (el) { return el.scrollWidth <= el.clientWidth + 1; });
    assert.ok(mesCabe, 'nome do mês cabe no seletor');
    assert.strictEqual(await p.textContent('#t-dizimos'), 'R$ 50,00');
    assert.strictEqual(await p.textContent('#t-ofertas'), 'R$ 26,00');
    assert.strictEqual(await p.textContent('#t-entradas'), 'R$ 76,00');
    assert.strictEqual(await p.textContent('#t-saidas'), 'R$ 800,00');
    assert.strictEqual(await p.textContent('#t-saldo'), '- R$ 724,00');
    assert.ok(await p.$eval('#linha-saldo', function (el) { return el.classList.contains('negativo'); }));
    var corSaida = await p.$eval('#lista .item.saida .item-valor', function (el) { return getComputedStyle(el).color; });
    var corEntrada = await p.$eval('#lista .item.entrada .item-valor', function (el) { return getComputedStyle(el).color; });
    assert.strictEqual(corSaida, 'rgb(192, 38, 45)');
    assert.strictEqual(corEntrada, 'rgb(26, 122, 56)');
    await p.screenshot({ path: path.join(PRINTS, '5-tela-lista.png'), fullPage: true });
  });

  await passo('excluir pede confirmação; cancelar não exclui; confirmar exclui', async function () {
    await p.click('#lista .item.saida .item-excluir');
    assert.strictEqual(await p.isVisible('#modal-fundo'), true);
    assert.ok(/Aluguel/.test(await p.textContent('#modal-texto')));
    await p.screenshot({ path: path.join(PRINTS, '6-confirmar-exclusao.png') });
    await p.click('#modal-cancelar');
    assert.strictEqual(await p.isVisible('#modal-fundo'), false);
    assert.strictEqual((await linhasPlanilha(p)).length, 5);

    await p.click('#lista .item.saida .item-excluir');
    await limparAviso(p);
    await p.click('#modal-confirmar');
    assert.ok(/excluído/.test(await textoAviso(p)));
    await p.waitForFunction(function () {
      return document.querySelectorAll('#lista .item').length === 3 && !document.getElementById('resumo').hidden;
    });
    assert.strictEqual(await p.textContent('#t-saidas'), 'R$ 0,00');
    assert.strictEqual(await p.textContent('#t-saldo'), 'R$ 76,00');
    assert.strictEqual((await linhasPlanilha(p)).length, 4);
    var excluidos = await p.evaluate(function () {
      return window.__gas._planilha.getSheetByName('Excluidos')._valores().length;
    });
    assert.strictEqual(excluidos, 2);
  });

  await passo('setas trocam o mês; mês vazio mostra aviso; limites de 2026', async function () {
    await p.click('#mes-anterior');
    await p.waitForFunction(function () { return /Nenhum lançamento em Outubro de 2026/.test(document.getElementById('estado-lista').textContent); });
    assert.strictEqual(await p.inputValue('#filtro-mes'), '10');
    await p.selectOption('#filtro-mes', '1');
    assert.strictEqual(await p.isDisabled('#mes-anterior'), true);
    await p.selectOption('#filtro-mes', '12');
    assert.strictEqual(await p.isDisabled('#mes-seguinte'), true);
  });

  await passo('botão Voltar e o "voltar" do celular retornam à Tela 1', async function () {
    await p.click('#voltar');
    await p.waitForSelector('#tela-novo:not([hidden])');
    assert.strictEqual(await p.isVisible('#tela-lista'), false);
    await p.click('#ir-lista');
    await p.waitForSelector('#tela-lista:not([hidden])');
    await p.goBack();
    await p.waitForSelector('#tela-novo:not([hidden])');
    await p.click('#ir-lista');
    await p.waitForSelector('#tela-lista:not([hidden])');
    await p.click('#voltar-rodape');
    await p.waitForSelector('#tela-novo:not([hidden])');
  });

  await passo('nenhum erro de JavaScript na página', async function () {
    assert.deepStrictEqual(p.__erros, []);
  });

  // ---- Prints com dados de exemplo (para conferência visual) ----
  await passo('prints com dados de exemplo (celular comum e celular pequeno)', async function () {
    var dispositivos = [
      ['pixel7', playwright.devices['Pixel 7']],
      ['pequeno', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }],
    ];
    for (var i = 0; i < dispositivos.length; i++) {
      var nome = dispositivos[i][0];
      var q = await novaPagina(navegador, { exemplos: true, dispositivo: dispositivos[i][1] });
      await digitarValor(q, '12735');
      await q.click('[data-tipo="Saída"]');
      await q.fill('#descricao', 'Conta de luz');
      await q.screenshot({ path: path.join(PRINTS, '7-' + nome + '-saida.png') });
      await q.click('#ir-lista');
      await q.waitForSelector('#resumo:not([hidden])');
      await q.screenshot({ path: path.join(PRINTS, '8-' + nome + '-lista.png'), fullPage: true });
      var larguraExtra = await q.evaluate(function () {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      });
      assert.strictEqual(larguraExtra, 0, 'sem rolagem horizontal (' + nome + ')');
      assert.deepStrictEqual(q.__erros, []);
      await q.context().close();
    }
  });

  await navegador.close();
  var ok = resultados.filter(Boolean).length;
  console.log('\n' + ok + ' de ' + resultados.length + ' testes de interface passaram. Prints em dev/prints/');
  process.exit(ok === resultados.length ? 0 : 1);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
