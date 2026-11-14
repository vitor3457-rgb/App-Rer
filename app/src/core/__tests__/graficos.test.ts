import { PALETA_CLARA, graficoBarras, graficoComparativo, graficoLinha } from '../graficos';
import { agruparPorMes, calcularCaixa, serieDiaria } from '../totais';
import { lanc, saida } from './fabrica';

const dados = [
  lanc({ dataReferencia: '2026-10-05', valorCentavos: 100000 }),
  saida('Aluguel', 80000, { dataReferencia: '2026-10-10' }),
  lanc({ dataReferencia: '2026-11-01', valorCentavos: 50000 }),
  saida('Luz & <água>', 20000, { dataReferencia: '2026-11-03' }),
];

test('barras: escreve rótulos e valores, e escapa caracteres especiais', () => {
  const g = graficoBarras([
    { rotulo: 'Dízimos', centavos: 45000, cor: '#1A7A38' },
    { rotulo: 'Luz & <água>', centavos: 0, cor: '#C0262D' },
  ], PALETA_CLARA);
  expect(g.xml).toContain('Dízimos');
  expect(g.xml).toContain('R$ 450,00');
  expect(g.xml).toContain('Luz &amp; &lt;água&gt;');
  expect(g.xml.match(/<rect /g)).toHaveLength(2); // fundo + 1 barra (valor zero não desenha barra)
  expect(g.altura).toBe(98);
});

test('linha: começa no saldo anterior e mostra o saldo final', () => {
  const caixa = calcularCaixa(agruparPorMes(dados), 0);
  const r = caixa.resumoDoMes('2026-11');
  const dias = serieDiaria(dados.filter((l) => l.dataReferencia.startsWith('2026-11')), '2026-11', r.saldoAnterior, '2026-11-05');
  const g = graficoLinha(dias, PALETA_CLARA);
  expect(dias.map((d) => d.saldo)).toEqual([70000, 70000, 50000, 50000, 50000]);
  expect(g.xml).toContain('R$ 500,00');
  expect(g.xml).toContain('dia 5');
  expect(g.xml.match(/<circle /g)).toHaveLength(2);
  expect(g.px(0)).toBeLessThan(g.px(4));
  expect(g.py(70000)).toBeLessThan(g.py(0)); // valores maiores ficam mais acima
});

test('linha: funciona com um dia só e com saldo negativo', () => {
  const g = graficoLinha([{ dia: 1, entrou: 0, saiu: 5000, saldo: -5000, temLancamento: true }], PALETA_CLARA);
  expect(g.xml).toContain('- R$ 50,00');
  expect(g.xml).not.toContain('NaN');
});

test('comparativo: uma dupla de barras por mês e legenda', () => {
  const caixa = calcularCaixa(agruparPorMes(dados), 0);
  const g = graficoComparativo(caixa.comparativo('2026-11', 3), PALETA_CLARA, '2026-11');
  expect(g.xml).toContain('Entradas');
  expect(g.xml).toContain('Saídas');
  expect(g.xml).toContain('set/26');
  expect(g.xml).toContain('nov/26');
  expect(g.xml.match(/<path /g)).toHaveLength(4); // out e nov têm entradas e saídas; set não tem nada
  expect(g.xml).not.toContain('NaN');
});
