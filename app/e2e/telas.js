/**
 * Testes das telas no navegador (Chromium, tamanho de celular), com o app em MODO DEMONSTRAÇÃO
 * (dados de exemplo, sem servidor). Também tira prints em e2e/prints/.
 * Rodar: npm run test:telas   (gera a versão web de teste antes)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { iniciar } = require('./servidor');

const PRINTS = path.join(__dirname, 'prints');
fs.mkdirSync(PRINTS, { recursive: true });
const AGORA = new Date('2026-11-14T15:00:00-03:00');
// Só o que está visível: as abas ficam montadas por baixo, então o mesmo botão pode existir em duas telas.
const t = (id) => `[data-testid="${id}"]:visible`;

const resultados = [];
async function passo(nome, fn) {
  try {
    await fn();
    resultados.push(true);
    console.log('  ✔ ' + nome);
  } catch (e) {
    resultados.push(false);
    console.log('  ✘ ' + nome + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 4).join('\n      '));
  }
}

function reais(texto) {
  const negativo = /^\s*-/.test(texto);
  const n = Number(texto.replace(/[^\d,]/g, '').replace(',', '.'));
  return Math.round(n * 100) * (negativo ? -1 : 1);
}

(async () => {
  const { servidor, url } = await iniciar(path.join(__dirname, '..', 'dist-demo'));
  const navegador = await chromium.launch();

  async function abrir(opcoes = {}) {
    const contexto = await navegador.newContext({
      ...(opcoes.dispositivo || devices['Pixel 7']), locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
      colorScheme: opcoes.escuro ? 'dark' : 'light', acceptDownloads: true,
    });
    const p = await contexto.newPage();
    p.erros = [];
    p.on('pageerror', (e) => p.erros.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') p.erros.push('console: ' + m.text()); });
    await p.clock.setFixedTime(AGORA);
    await p.goto(url);
    await p.waitForSelector(t('tela-login'));
    if (opcoes.entrar !== false) {
      await p.click(t('entrar-google'));
      await p.waitForSelector(t('tela-inicio'));
      await p.click(t('aba-novo'));
      await p.waitForSelector(t('tela-novo'));
      await p.waitForSelector(t('responsavel-Alex'));
    }
    return p;
  }
  const print = (p, nome, inteira = false) => p.screenshot({ path: path.join(PRINTS, nome + '.png'), fullPage: inteira });
  const texto = async (p, id) => (await p.locator(t(id)).first().innerText()).trim();
  async function aviso(p) {
    await p.waitForSelector(t('aviso'), { timeout: 8000 });
    const txt = await texto(p, 'aviso');
    await p.click(t('aviso'));
    await p.waitForSelector(t('aviso'), { state: 'detached' });
    return txt;
  }
  const demo = (p, codigo) => p.evaluate(codigo);
  const D = (id) => t('tela-dashboard') + ' ' + t(id); // dentro do Dashboard
  // Dentro da lista de lançamentos (no navegador a tela Início, com os últimos lançamentos, fica por baixo).
  const L = (id) => t('tela-lancamentos') + ' ' + t(id);
  const voltar = (p) => p.locator(t('voltar')).last().click(); // a tela de cima é a última
  /** Espera a quantidade de elementos visíveis chegar a `n` (a tela redesenha um instante depois da ação). */
  async function contar(p, seletor, n) {
    const inicio = Date.now();
    let atual = -1;
    while (Date.now() - inicio < 5000) {
      atual = await p.locator(seletor).count();
      if (atual === n) return;
      await p.waitForTimeout(100);
    }
    const textos = await p.locator(seletor).allInnerTexts();
    throw new Error(`esperava ${n} elemento(s) em ${seletor}, mas há ${atual}: ${JSON.stringify(textos.map((x) => x.replace(/\n/g, ' ')).slice(0, 4))}`);
  }
  const linhasServidor = (p) => demo(p, () => Array.from(window.__ADRER_DEMO__.servidor.lancamentos.values()).filter((l) => !l.excluidoEm));

  const p = await abrir({ entrar: false });

  await passo('login: mostra o logo e entra', async () => {
    await print(p, '00-login');
    await p.click(t('entrar-google'));
    await p.waitForSelector(t('tela-inicio'));
    assert.match(await texto(p, 'cabecalho-titulo'), /Olá, Demonstração/);
    const caixaInicio = reais(await texto(p, 'inicio-caixa'));
    const todos = await linhasServidor(p);
    const esperado = 150000 + todos.reduce((s, l) => s + (l.tipo === 'Entrada' ? 1 : -1) * l.valorCentavos, 0);
    assert.strictEqual(caixaInicio, esperado, 'saldo em caixa = abertura + entradas - saídas');
    assert.ok(await p.locator(t('inicio-grafico') + ' svg').count(), 'gráfico do caixa do mês');
    assert.strictEqual(await p.locator(t('ultimos') + ' ' + t('item-lancamento')).count(), 5);
    await print(p, '01-inicio', true);
    await p.click(t('aba-novo'));
    await p.waitForSelector(t('tela-novo'));
    await p.waitForSelector(t('responsavel-Alex'));
    assert.match(await p.getAttribute(t('responsavel-Alex'), 'aria-label'), /escolhido/, 'Alex já vem escolhido');
    assert.match(await texto(p, 'chip-sinc'), /Sincronizado|Atualizando/);
    await print(p, '01-novo');
  });

  await passo('início: "ver todos" abre os lançamentos do mês atual', async () => {
    await p.click(t('aba-inicio'));
    await p.click(t('ver-todos'));
    await p.waitForSelector(t('tela-lancamentos'));
    assert.match(await texto(p, 'mes-atual'), /Novembro de 2026/);
    assert.ok(await p.locator(t('grupo-dia')).count() >= 3, 'lista agrupada por dia');
    await p.click(t('aba-novo'));
    await p.waitForSelector(t('tela-novo'));
  });

  let antes = 0;
  await passo('novo lançamento: valida os campos em ordem, com mensagens claras', async () => {
    antes = (await linhasServidor(p)).length;
    await p.click(t('salvar'));
    assert.match(await texto(p, 'erro-form'), /Digite o valor/);
    await p.click(t('valor'));
    await p.keyboard.type('5000');
    assert.strictEqual(await p.inputValue(t('valor')), 'R$ 50,00');
    await p.click(t('salvar'));
    assert.match(await texto(p, 'erro-form'), /Entrada ou Saída/);
    await p.click(t('tipo-entrada'));
    await p.click(t('salvar'));
    assert.match(await texto(p, 'erro-form'), /Dízimo ou Oferta/);
    await p.click(t('categoria-dizimo'));
    await p.click(t('salvar'));
    assert.match(await texto(p, 'erro-form'), /nome de quem deu o dízimo/);
    await p.fill(t('contribuinte'), 'Fulano');
    await p.click(t('salvar'));
    assert.match(await texto(p, 'erro-form'), /forma de pagamento: Dinheiro ou PIX/);
    await p.fill(t('contribuinte'), '');
    await print(p, '02-validacao');
  });

  await passo('máscara do valor: apagar remove o último número', async () => {
    await p.click(t('valor'));
    await p.keyboard.press('Backspace');
    assert.strictEqual(await p.inputValue(t('valor')), 'R$ 5,00');
    await p.keyboard.type('0');
    assert.strictEqual(await p.inputValue(t('valor')), 'R$ 50,00');
  });

  await passo('nome de quem contribuiu: sugestões filtram ao digitar e preenchem ao tocar', async () => {
    const sugestoes = await p.locator(t('sugestoes-contribuinte') + ' [role="button"]').allInnerTexts();
    assert.ok(sugestoes.includes('Silvana') && sugestoes.includes('Ana Paula'), sugestoes.join());
    await p.fill(t('contribuinte'), 'mar');
    assert.deepStrictEqual(await p.locator(t('sugestoes-contribuinte') + ' [role="button"]').allInnerTexts(), ['Maria das Graças']);
    await p.click(t('sugestoes-contribuinte') + ' [role="button"]');
    assert.strictEqual(await p.inputValue(t('contribuinte')), 'Maria das Graças');
    await p.fill(t('contribuinte'), 'Novo Irmão');
  });

  await passo('salva o dízimo, avisa, limpa o formulário e envia ao servidor', async () => {
    await p.click(t('responsavel-Lázaro'));
    await p.click(t('forma-pix'));
    await p.fill(t('observacao'), 'Retirado da salva');
    await p.click(t('salvar'));
    const msg = await aviso(p);
    assert.match(msg, /Lançamento salvo!/);
    assert.match(msg, /Dízimo de Novo Irmão · R\$ 50,00 · 14\/11\/2026 · Lázaro/);
    assert.strictEqual(await p.inputValue(t('valor')), '');
    assert.strictEqual(await p.locator(t('contribuinte')).count(), 0, 'campos da entrada somem');
    assert.match(await p.getAttribute(t('responsavel-Lázaro'), 'aria-label'), /escolhido/, 'responsável continua escolhido');
    await p.waitForFunction((n) => Array.from(window.__ADRER_DEMO__.servidor.lancamentos.values()).length === n + 1, antes);
    const novo = (await linhasServidor(p)).find((l) => l.descricao === 'Novo Irmão');
    assert.deepStrictEqual([novo.tipo, novo.categoria, novo.valorCentavos, novo.responsavel, novo.dataReferencia], ['Entrada', 'Dízimo', 5000, 'Lázaro', '2026-11-14']);
    assert.ok(novo.membroId, 'virou cadastro de membro');
    assert.deepStrictEqual([novo.formaPagamento, novo.observacao], ['PIX', 'Retirado da salva']);
  });

  await passo('saída: exige descrição, usa sugestão e troca a data pelo calendário', async () => {
    await p.click(t('valor'));
    await p.keyboard.type('13117');
    await p.click(t('tipo-saida'));
    await p.click(t('salvar'));
    assert.match(await texto(p, 'erro-form'), /descrição da despesa/);
    await p.click(t('sugestoes-descricao') + ' [role="button"]:has-text("Luz")');
    assert.strictEqual(await p.inputValue(t('descricao')), 'Luz');
    await p.click(t('campo-data'));
    await p.waitForSelector(t('calendario'));
    await print(p, '03-calendario');
    await p.click(t('dia-2026-11-10'));
    assert.match(await texto(p, 'campo-data'), /10\/11\/2026/);
    await p.click(t('salvar'));
    assert.match(await aviso(p), /Saída · Luz · R\$ 131,17 · 10\/11\/2026/);
  });

  await passo('sem internet: salva no celular, mostra "a enviar" e envia quando a internet volta', async () => {
    await p.waitForFunction(() => window.__ADRER_DEMO__.banco.loja.getState().fila.length === 0 && !window.__ADRER_DEMO__.banco.loja.getState().sinc.andamento);
    await demo(p, () => { window.__ADRER_DEMO__.remoto.online = false; });
    await p.click(t('valor'));
    await p.keyboard.type('2500');
    await p.click(t('tipo-entrada'));
    await p.click(t('categoria-oferta'));
    await p.click(t('forma-dinheiro'));
    await p.click(t('salvar'));
    assert.match(await aviso(p), /Sem internet agora: será enviado quando a conexão voltar/);
    await p.waitForFunction(() => /Sem internet · 1 a enviar/.test(document.querySelector('[data-testid="chip-sinc"]').innerText), null, { timeout: 8000 })
      .catch(async () => { throw new Error('chip mostra: ' + JSON.stringify(await texto(p, 'chip-sinc')) + ' fila=' + JSON.stringify(await demo(p, () => window.__ADRER_DEMO__.banco.loja.getState().fila.map((o) => o.op)))); });
    await print(p, '04-sem-internet');
    await p.click(t('aba-lancamentos'));
    await p.waitForSelector(t('tela-lancamentos'));
    assert.strictEqual(await p.locator(L('item-pendente')).count(), 1);
    const naFila = (await linhasServidor(p)).filter((l) => l.valorCentavos === 2500 && l.categoria === 'Oferta').length;
    assert.strictEqual(naFila, 0, 'ainda não chegou ao servidor');
    await demo(p, () => { window.__ADRER_DEMO__.remoto.online = true; window.__ADRER_DEMO__.banco.definirOnline(true); });
    await p.waitForFunction(() => /Sincronizado/.test(document.querySelector('[data-testid="chip-sinc"]').innerText));
    assert.strictEqual(await p.locator(L('item-pendente')).count(), 0);
    assert.strictEqual((await linhasServidor(p)).filter((l) => l.valorCentavos === 2500 && l.categoria === 'Oferta').length, 1);
  });

  let caixaNov = 0;
  await passo('lançamentos: lista do mês, cores e resumo com saldo anterior → saldo em caixa', async () => {
    assert.match(await texto(p, 'mes-atual'), /Novembro de 2026/);
    const itens = await p.locator(L('item-lancamento')).count();
    const servidorNov = (await linhasServidor(p)).filter((l) => l.dataReferencia.startsWith('2026-11'));
    assert.strictEqual(itens, servidorNov.length);
    const soma = (f) => servidorNov.filter(f).reduce((s, l) => s + l.valorCentavos, 0);
    const entradas = soma((l) => l.tipo === 'Entrada');
    const saidas = soma((l) => l.tipo === 'Saída');
    assert.strictEqual(reais(await texto(p, 'r-entradas')), entradas);
    assert.strictEqual(reais(await texto(p, 'r-saidas')), saidas);
    assert.strictEqual(reais(await texto(p, 'r-dizimos')), soma((l) => l.categoria === 'Dízimo'));
    assert.strictEqual(reais(await texto(p, 'r-ofertas')), soma((l) => l.categoria === 'Oferta'));
    const anterior = reais(await texto(p, 'r-anterior'));
    caixaNov = reais(await texto(p, 'r-caixa'));
    assert.strictEqual(caixaNov, anterior + entradas - saidas, 'saldo em caixa = anterior + entradas - saídas');
    const todos = await linhasServidor(p);
    const antesDeNov = todos.filter((l) => l.dataReferencia < '2026-11-01').reduce((s, l) => s + (l.tipo === 'Entrada' ? 1 : -1) * l.valorCentavos, 0);
    assert.strictEqual(anterior, 150000 + antesDeNov, 'saldo anterior = abertura + tudo o que veio antes');
    const corEntrada = await p.locator(L('item-lancamento') + ':has-text("Oferta") ' + t('item-valor')).first().evaluate((e) => getComputedStyle(e).color);
    const corSaida = await p.locator(L('item-lancamento') + ':has-text("Aluguel") ' + t('item-valor')).first().evaluate((e) => getComputedStyle(e).color);
    assert.strictEqual(corEntrada, 'rgb(26, 122, 56)');
    assert.strictEqual(corSaida, 'rgb(192, 38, 45)');
    await print(p, '05-lancamentos', true);
  });

  await passo('o mês seguinte começa com o saldo em que este terminou', async () => {
    await p.click(t('mes-seguinte'));
    assert.match(await texto(p, 'mes-atual'), /Dezembro de 2026/);
    assert.strictEqual(reais(await texto(p, 'r-anterior')), caixaNov);
    assert.strictEqual(reais(await texto(p, 'r-caixa')), caixaNov);
    assert.match(await p.locator(t('lista')).innerText(), /Nenhum lançamento em Dezembro de 2026/);
    await p.click(t('mes-anterior'));
    await p.click(t('mes-anterior'));
    assert.match(await texto(p, 'mes-atual'), /Outubro de 2026/);
    const caixaOut = reais(await texto(p, 'r-caixa'));
    await p.click(t('mes-seguinte'));
    assert.strictEqual(reais(await texto(p, 'r-anterior')), caixaOut);
  });

  await passo('escolher o mês pela lista de meses', async () => {
    await p.click(t('mes-atual'));
    await p.waitForSelector(t('lista-meses'));
    await print(p, '06-escolher-mes');
    await p.click(t('mes-2026-09'));
    assert.match(await texto(p, 'mes-atual'), /Setembro de 2026/);
    await p.click(t('mes-atual'));
    await p.click(t('mes-2026-11'));
    assert.match(await texto(p, 'mes-atual'), /Novembro de 2026/);
  });

  await passo('busca e filtros', async () => {
    const total = await p.locator(L('item-lancamento')).count();
    await p.fill(t('busca'), 'aluguel');
    await contar(p, L('item-lancamento'), 1);
    assert.match(await texto(p, 'contagem-filtro'), new RegExp('Mostrando 1 de ' + total));
    await p.fill(t('busca'), 'zzz');
    assert.match(await p.locator(t('lista')).innerText(), /Nada encontrado/);
    await p.click(t('busca-limpar'));
    await contar(p, L('item-lancamento'), total);
    await p.click(t('filtro-saídas'));
    await p.waitForSelector(t('contagem-filtro'));
    const saidas = await p.locator(L('item-lancamento')).count();
    await p.click(t('filtro-entradas'));
    await p.waitForFunction((n) => !document.querySelector('[data-testid="contagem-filtro"]').innerText.includes('Mostrando ' + n + ' de'), saidas);
    const entradas = await p.locator(L('item-lancamento')).count();
    assert.strictEqual(saidas + entradas, total);
    await p.click(t('filtro-todos'));
    await contar(p, L('item-lancamento'), total);
    await p.fill(t('busca'), '131,17');
    await contar(p, L('item-lancamento'), 1);
    await p.click(t('busca-limpar'));
    await contar(p, L('item-lancamento'), total);
  });

  await passo('excluir pede confirmação; cancelar mantém; confirmar tira da lista e dos totais', async () => {
    const total = await p.locator(L('item-lancamento')).count();
    const saidasAntes = reais(await texto(p, 'r-saidas'));
    const item = p.locator(L('item-lancamento') + ':has-text("Luz")').first();
    await item.click({ delay: 900 }); // segurar o dedo pede para excluir
    await p.waitForSelector(t('pergunta'));
    assert.match(await texto(p, 'pergunta'), /Excluir este lançamento\?[\s\S]*Luz[\s\S]*R\$ 131,17/);
    await print(p, '07-confirmar-exclusao');
    await p.click(t('pergunta-cancelar'));
    assert.strictEqual(await p.locator(L('item-lancamento')).count(), total);
    await item.click(); // tocar abre o detalhe, que também tem o botão Excluir
    await p.waitForSelector(t('tela-detalhe'));
    await p.click(t('detalhe-excluir'));
    await p.click(t('pergunta-confirmar'));
    await p.waitForSelector(t('tela-lancamentos'));
    assert.match(await aviso(p), /excluído/);
    await contar(p, L('item-lancamento'), total - 1);
    assert.strictEqual(reais(await texto(p, 'r-saidas')), saidasAntes - 13117);
    await p.waitForFunction(() => Array.from(window.__ADRER_DEMO__.servidor.lancamentos.values()).some((l) => l.excluidoEm && l.excluidoPor === 'demo@adrer.app'));
  });

  await passo('detalhe do lançamento: ver e alterar', async () => {
    await p.locator(L('item-lancamento') + ':has-text("Novo Irmão")').click();
    await p.waitForSelector(t('tela-detalhe'));
    assert.match(await texto(p, 'detalhe-valor'), /\+ R\$ 50,00/);
    assert.match(await texto(p, 'detalhe-titulo'), /Dízimo · Novo Irmão/);
    assert.match(await texto(p, 'tela-detalhe'), /Forma de pagamento\s*PIX/);
    assert.match(await texto(p, 'detalhe-observacao'), /Retirado da salva/);
    await print(p, '08-detalhe');
    await p.click(t('detalhe-alterar'));
    assert.strictEqual(await p.inputValue(t('valor')), 'R$ 50,00');
    assert.strictEqual(await p.inputValue(t('contribuinte')), 'Novo Irmão');
    await p.click(t('valor'));
    await p.keyboard.press('Backspace');
    await p.keyboard.press('Backspace');
    await p.keyboard.press('Backspace');
    await p.keyboard.type('550');
    await p.click(t('salvar'));
    assert.match(await aviso(p), /Alteração salva/);
    assert.match(await texto(p, 'detalhe-valor'), /\+ R\$ 55,50/);
    await p.waitForFunction(() => Array.from(window.__ADRER_DEMO__.servidor.lancamentos.values()).some((l) => l.descricao === 'Novo Irmão' && l.valorCentavos === 5550));
    await voltar(p);
    await p.waitForSelector(t('tela-lancamentos'));
  });

  await passo('exportar Excel: baixa a planilha do mês com as colunas e o resumo do caixa', async () => {
    const espera = p.waitForEvent('download'); espera.catch(() => {});
    await p.click(t('exportar-excel'));
    const download = await espera;
    assert.strictEqual(download.suggestedFilename(), 'ADRER-lancamentos-2026-11.xlsx');
    const XLSX = require('xlsx');
    const livro = XLSX.readFile(await download.path());
    assert.deepStrictEqual(livro.SheetNames, ['Lançamentos', 'Resumo']);
    const linhas = XLSX.utils.sheet_to_json(livro.Sheets['Lançamentos'], { header: 1 });
    assert.strictEqual(linhas[0][10], 'Responsável');
    assert.strictEqual(linhas.length - 1, await p.locator(L('item-lancamento')).count());
    const resumo = XLSX.utils.sheet_to_json(livro.Sheets.Resumo, { header: 1 });
    assert.strictEqual(resumo[9][0], 'Saldo em caixa');
    assert.strictEqual(Math.round(resumo[9][1] * 100), reais(await texto(p, 'r-caixa')));
  });

  await passo('exportar PDF: abre o relatório do mês pronto para imprimir/salvar', async () => {
    const espera = p.context().waitForEvent('page'); espera.catch(() => {});
    await p.click(t('exportar-pdf'));
    const relatorio = await espera;
    await relatorio.waitForLoadState();
    const corpo = await relatorio.locator('body').innerText();
    assert.match(corpo, /ADRER[\s\S]*Assembleia de Deus Rocha Eterna dos Remidos[\s\S]*Relatório financeiro - Novembro de 2026/);
    assert.match(corpo, /Saldo anterior[\s\S]*Saldo em caixa[\s\S]*Aluguel/);
    await relatorio.pdf({ path: path.join(PRINTS, 'relatorio-exemplo.pdf'), format: 'A4', printBackground: true }).catch(() => {});
    await relatorio.close();
  });

  await passo('dashboard: números batem com a tela de lançamentos e os gráficos aparecem', async () => {
    const entradas = reais(await texto(p, 'r-entradas'));
    const caixa = reais(await texto(p, 'r-caixa'));
    await p.click(t('aba-dashboard'));
    await p.waitForSelector(t('tela-dashboard'));
    assert.match(await texto(p, 'mes-atual'), /Novembro de 2026/, 'mesmo mês da outra tela');
    assert.strictEqual(reais(await texto(p, 'k-entradas')), entradas);
    assert.strictEqual(reais(await texto(p, 'k-caixa')), caixa);
    for (const g of ['g-linha', 'g-rosca', 'g-despesas', 'g-comparativo']) {
      assert.ok(await p.locator(t(g) + ' svg').count(), 'gráfico ' + g);
    }
    assert.match(await p.locator(t('g-rosca')).innerText(), /Dízimos[\s\S]*Ofertas[\s\S]*Saídas/);
    assert.strictEqual(await p.locator('[data-testid^="comp-"]').count(), 6);
    assert.strictEqual(reais((await texto(p, 'comp-2026-11')).split('\n').pop()), caixa);
    await print(p, '09-dashboard', true);
  });

  await passo('gráfico do caixa: tocar mostra o dia', async () => {
    const caixa = await p.locator(t('g-linha')).boundingBox();
    await p.mouse.click(caixa.x + caixa.width * 0.6, caixa.y + caixa.height * 0.5);
    assert.match(await texto(p, 'dica-grafico'), /Dia \d+ · caixa (- )?R\$/);
  });

  await passo('exportar dashboard em PDF: página com os gráficos e a tabela dos últimos meses', async () => {
    const espera = p.context().waitForEvent('page'); espera.catch(() => {});
    await p.click(t('exportar-dashboard'));
    const relatorio = await espera;
    await relatorio.waitForLoadState();
    assert.match(await relatorio.locator('body').innerText(), /Dashboard financeiro - Novembro de 2026[\s\S]*Caixa ao longo do mês[\s\S]*Maiores despesas[\s\S]*Últimos meses/);
    assert.strictEqual(await relatorio.locator('svg').count(), 4);
    await relatorio.pdf({ path: path.join(PRINTS, 'dashboard-exemplo.pdf'), format: 'A4', printBackground: true }).catch(() => {});
    await relatorio.close();
  });

  await passo('PDF para a contabilidade: origens = aplicações, só com despesas reais', async () => {
    const entradas = reais(await texto(p, 'k-entradas'));
    const saidas = reais(await texto(p, 'k-saidas'));
    const espera = p.context().waitForEvent('page'); espera.catch(() => {});
    await p.click(t('exportar-contabilidade'));
    const relatorio = await espera;
    await relatorio.waitForLoadState();
    const corpo = await relatorio.locator('body').innerText();
    assert.match(corpo, /Demonstrativo de origens e aplicações - Novembro de 2026/);
    const brl = (c) => 'R\\$ ' + (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const total = Math.max(entradas, saidas);
    assert.match(corpo, new RegExp('Total das origens ' + brl(total) + ' = Total das aplicações ' + brl(total)));
    assert.match(corpo, /Aluguel/);
    assert.doesNotMatch(corpo, /Outros|Outras despesas/);
    if (entradas > saidas) assert.match(corpo, new RegExp('Saldo do mês mantido em caixa \\(superávit\\)\\s*' + brl(entradas - saidas)));
    await relatorio.pdf({ path: path.join(PRINTS, 'contabilidade-exemplo.pdf'), format: 'A4', printBackground: true }).catch(() => {});
    await relatorio.close();
  });

  await passo('mês sem lançamentos: aviso em vez de gráficos vazios e exportação bloqueada', async () => {
    await p.click(D('mes-seguinte'));
    assert.match(await p.locator(t('tela-dashboard')).innerText(), /Nenhum lançamento em Dezembro de 2026/);
    assert.strictEqual(await p.locator(t('g-linha')).count(), 0);
    await p.click(t('exportar-dashboard'));
    assert.match(await aviso(p), /Não há lançamentos em Dezembro de 2026/);
    await p.click(D('mes-anterior'));
  });

  await passo('mais: conta, caixa de hoje e menu do administrador', async () => {
    await p.click(t('aba-mais'));
    await p.waitForSelector(t('tela-mais'));
    assert.strictEqual(await texto(p, 'conta-email'), 'demo@adrer.app');
    assert.strictEqual(reais(await texto(p, 'caixa-hoje')), caixaNov + 13117 + 550, 'caixa de hoje reflete a exclusão e a alteração');
    assert.ok(await p.locator(t('menu-usuarios')).count());
    await print(p, '10-mais', true);
  });

  await passo('saldo de abertura: mudar altera o caixa de todos os meses', async () => {
    const antesCaixa = reais(await texto(p, 'caixa-hoje'));
    await p.click(t('menu-abertura'));
    await p.waitForSelector(t('janela-abertura'));
    assert.strictEqual(await p.inputValue(t('abertura-valor')), 'R$ 1.500,00');
    await p.click(t('abertura-valor'));
    for (let i = 0; i < 8; i++) await p.keyboard.press('Backspace');
    await p.keyboard.type('200000');
    await p.click(t('abertura-salvar'));
    assert.match(await aviso(p), /Saldo de abertura atualizado/);
    assert.strictEqual(reais(await texto(p, 'caixa-hoje')), antesCaixa + 50000);
  });

  await passo('membros: lista com totais, busca, histórico e cadastro novo', async () => {
    await p.click(t('menu-membros'));
    await p.waitForSelector(t('tela-membros'));
    assert.ok((await p.locator(t('item-membro')).count()) >= 5);
    await p.fill(t('busca-membro'), 'silv');
    await contar(p, t('item-membro'), 1);
    await p.click(t('item-membro'));
    await p.waitForSelector(t('tela-membro'));
    assert.ok(reais(await texto(p, 'membro-total')) > 0);
    assert.ok((await p.locator(t('item-lancamento')).count()) >= 4, 'histórico de vários meses');
    await print(p, '11-membro', true);
    await p.fill(t('membro-nome'), 'Silvana Souza');
    await p.click(t('membro-salvar'));
    assert.match(await aviso(p), /Cadastro salvo/);
    await p.waitForFunction(() => Array.from(window.__ADRER_DEMO__.servidor.lancamentos.values()).filter((l) => l.descricao === 'Silvana Souza').length >= 4);
    await voltar(p);
    await p.fill(t('busca-membro'), '');
    await p.click(t('novo-membro'));
    await p.fill(t('membro-nome'), 'silvana souza');
    await p.click(t('membro-salvar'));
    assert.match(await texto(p, 'erro-membro'), /Já existe um cadastro com esse nome/);
    await p.fill(t('membro-nome'), 'Pedro Henrique');
    await p.click(t('membro-salvar'));
    assert.match(await aviso(p), /Cadastro criado: Pedro Henrique/);
    await voltar(p);
    await p.waitForSelector(t('tela-mais'));
  });

  await passo('usuários: incluir o tesoureiro e impedir ficar sem administrador', async () => {
    await p.click(t('menu-usuarios'));
    await p.waitForSelector(t('tela-usuarios'));
    await contar(p, t('item-usuario'), 2);
    await p.click(t('novo-usuario'));
    await p.fill(t('usuario-email'), 'sem-arroba');
    await p.click(t('usuario-salvar'));
    assert.match(await texto(p, 'erro-usuario'), /e-mail completo/);
    await p.fill(t('usuario-email'), ' Novo.Tesoureiro@Gmail.com ');
    await p.fill(t('usuario-nome'), 'Novo Tesoureiro');
    await p.click(t('usuario-salvar'));
    assert.match(await aviso(p), /Usuário incluído/);
    await contar(p, t('item-usuario'), 3);
    assert.ok(await demo(p, () => window.__ADRER_DEMO__.servidor.usuarios.some((u) => u.email === 'novo.tesoureiro@gmail.com' && u.papel === 'tesoureiro')));
    await print(p, '12-usuarios');
    await p.locator(t('item-usuario') + ':has-text("(você)")').click();
    await p.click(t('papel-leitor'));
    await p.click(t('usuario-salvar'));
    assert.match(await texto(p, 'erro-usuario'), /pelo menos um administrador/);
    await p.click(t('janela-fechar'));
    await voltar(p);
  });

  await passo('responsáveis: incluir um nome novo, que aparece no formulário', async () => {
    await p.click(t('menu-responsaveis'));
    await p.waitForSelector(t('tela-responsaveis'));
    await contar(p, t('item-responsavel'), 3);
    await p.click(t('novo-responsavel'));
    await p.fill(t('responsavel-nome'), 'alex');
    await p.click(t('responsavel-salvar'));
    assert.match(await texto(p, 'erro-responsavel'), /Já existe um responsável com esse nome/);
    await p.fill(t('responsavel-nome'), 'Marta');
    await p.click(t('responsavel-salvar'));
    assert.match(await aviso(p), /Responsável salvo/);
    await contar(p, t('item-responsavel'), 4);
    await voltar(p);
    await p.click(t('aba-novo'));
    await p.waitForSelector(t('responsavel-Marta'));
    await p.click(t('aba-mais'));
  });

  await passo('modo escuro pela tela Mais', async () => {
    await p.click(t('tema-escuro'));
    const fundo = await p.locator(t('tela-mais')).evaluate(() => getComputedStyle(document.querySelector('[data-testid="tela-mais"] > div:nth-child(2)') || document.body).backgroundColor);
    await print(p, '13-mais-escuro');
    await p.click(t('aba-dashboard'));
    await p.waitForSelector(t('g-linha'));
    await print(p, '14-dashboard-escuro', true);
    await p.click(t('aba-novo'));
    await print(p, '15-novo-escuro');
    await p.click(t('aba-mais'));
    await p.click(t('tema-claro'));
    assert.ok(fundo);
  });

  await passo('sair da conta volta para o login', async () => {
    await p.click(t('menu-sair'));
    await p.waitForSelector(t('pergunta'));
    await p.click(t('pergunta-confirmar'));
    await p.waitForSelector(t('tela-login'));
  });

  await passo('nenhum erro de JavaScript durante o uso', async () => {
    assert.deepStrictEqual(p.erros, []);
  });

  await passo('telas pequenas (360 px) e modo escuro do sistema: sem rolagem lateral', async () => {
    const q = await abrir({ escuro: true, dispositivo: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
    for (const [aba, tela] of [['aba-inicio', 'tela-inicio'], ['aba-lancamentos', 'tela-lancamentos'], ['aba-dashboard', 'tela-dashboard'], ['aba-mais', 'tela-mais'], ['aba-novo', 'tela-novo']]) {
      await q.click(t(aba));
      await q.waitForSelector(t(tela));
      await q.waitForTimeout(250);
      const sobra = await q.evaluate(() => {
        let pior = 0;
        document.querySelectorAll('*').forEach((el) => { pior = Math.max(pior, el.scrollWidth - el.clientWidth > 1 && getComputedStyle(el).overflowX !== 'hidden' && el.clientWidth > 300 ? el.scrollWidth - el.clientWidth : 0); });
        return pior;
      });
      assert.strictEqual(sobra, 0, 'rolagem lateral em ' + tela);
      await q.screenshot({ path: path.join(PRINTS, '20-pequeno-escuro-' + tela + '.png'), fullPage: true });
    }
    assert.deepStrictEqual(q.erros, []);
    await q.context().close();
  });

  await passo('conta que não está na lista vê "Acesso não autorizado" e consegue sair', async () => {
    const q = await abrir({ entrar: false });
    await q.evaluate(() => { window.__ADRER_DEMO__.servidor.usuarios = window.__ADRER_DEMO__.servidor.usuarios.filter((u) => u.email !== 'demo@adrer.app'); });
    await q.click(t('entrar-google'));
    await q.waitForSelector(t('tela-sem-acesso'), { timeout: 8000 }).catch(async (e) => {
      await q.screenshot({ path: path.join(PRINTS, 'falha-sem-acesso.png') });
      throw new Error('não abriu a tela sem-acesso. URL: ' + q.url() + ' texto: ' + (await q.locator('body').innerText()).slice(0, 200) + ' erros: ' + JSON.stringify(q.erros));
    });
    await q.waitForFunction(() => /Acesso não autorizado/.test(document.body.innerText));
    assert.match(await q.locator('body').innerText(), /demo@adrer\.app/);
    await q.screenshot({ path: path.join(PRINTS, '21-sem-acesso.png') });
    await q.click(t('sair'));
    await q.waitForSelector(t('tela-login'));
    await q.context().close();
  });

  await navegador.close();
  servidor.close();
  const ok = resultados.filter(Boolean).length;
  console.log(`\n${ok} de ${resultados.length} testes de tela passaram. Prints em app/e2e/prints/`);
  process.exit(ok === resultados.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
