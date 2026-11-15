import * as XLSX from 'xlsx';

import { PALETA_CLARA, graficoBarras, graficoComparativo, graficoLinha } from '../graficos';
import { COLUNAS_EXCEL, gerarExcel, htmlDashboard, htmlRelatorio, nomeArquivo } from '../relatorios';
import { agruparPorMes, calcularCaixa, serieDiaria } from '../totais';
import { lanc, saida } from './fabrica';

const cab = { nomeApp: 'ADRER', nomeCompleto: 'Assembleia de Deus Rocha Eterna dos Remidos', logo: 'data:image/png;base64,AAAA', geradoPor: 'dono@gmail.com', geradoEm: '14/11/2026 15:00' };
const dados = [
  lanc({ dataReferencia: '2026-10-05', valorCentavos: 100000 }),
  saida('Aluguel', 80000, { dataReferencia: '2026-10-10' }),
  lanc({ dataReferencia: '2026-11-08', valorCentavos: 5000, descricao: 'Silvana', criadoEm: '2026-11-08T15:30:00.000Z' }),
  lanc({ dataReferencia: '2026-11-01', categoria: 'Oferta', descricao: '', valorCentavos: 2050 }),
  saida('Luz <b>&', 12735, { dataReferencia: '2026-11-03', comprovante: '2026/11/x.jpg', responsavel: 'Júlio', formaPagamento: 'PIX', observacao: 'Pago no vencimento' }),
];
const porMes = agruparPorMes(dados);
const caixa = calcularCaixa(porMes, 0);
const nov = porMes.get('2026-11')!;
const resumo = caixa.resumoDoMes('2026-11');

test('nome dos arquivos', () => {
  expect(nomeArquivo('ADRER', 'lancamentos', '2026-11', 'xlsx')).toBe('ADRER-lancamentos-2026-11.xlsx');
  expect(nomeArquivo('A D/R', 'dashboard', '2026-01', 'pdf')).toBe('ADR-dashboard-2026-01.pdf');
});

test('Excel: colunas, tipos de dado, ordem e aba de resumo com o caixa', () => {
  const livro = XLSX.read(gerarExcel(nov, resumo, cab), { type: 'base64', cellNF: true });
  expect(livro.SheetNames).toEqual(['Lançamentos', 'Resumo']);
  const aba = livro.Sheets['Lançamentos'];
  const linhas = XLSX.utils.sheet_to_json<any[]>(aba, { header: 1, raw: true });
  expect(linhas[0]).toEqual(COLUNAS_EXCEL);
  expect(linhas).toHaveLength(4);
  expect(linhas.slice(1).map((l) => l[7])).toEqual(['', 'Luz <b>&', 'Silvana']); // do mais antigo para o mais novo
  expect(aba.C2.t).toBe('n');
  expect(XLSX.SSF.format(aba.C2.z, aba.C2.v)).toBe('01/11/2026');
  expect(linhas[2].slice(3, 14)).toEqual([2026, 11, 'Saída', 'Despesa', 'Luz <b>&', 127.35, 'dono@gmail.com', 'Júlio', 'Sim', 'PIX', 'Pago no vencimento']);
  const r = XLSX.utils.sheet_to_json<any[]>(livro.Sheets.Resumo, { header: 1, raw: true });
  expect(r[0][0]).toBe('ADRER - Assembleia de Deus Rocha Eterna dos Remidos');
  expect(r[3]).toEqual(['Saldo anterior', 200]);
  expect(r[6]).toEqual(['Total de entradas', 70.5]);
  expect(r[9]).toEqual(['Saldo em caixa', 143.15]);
});

test('relatório em HTML: caixa, lista em ordem e texto protegido', () => {
  const html = htmlRelatorio(nov, resumo, cab);
  expect(html).toContain('Relatório financeiro - Novembro de 2026');
  expect(html).toContain('Saldo anterior');
  expect(html).toContain('R$ 200,00');
  expect(html).toContain('Saldo em caixa');
  expect(html).toContain('R$ 143,15');
  expect(html).toContain('Luz &lt;b&gt;&amp;');
  expect(html).not.toContain('Luz <b>&');
  expect(html.indexOf('01/11/2026')).toBeLessThan(html.indexOf('08/11/2026'));
  expect(html).toContain('Gerado em 14/11/2026 15:00 por dono@gmail.com');
  expect(htmlRelatorio([], caixa.resumoDoMes('2026-12'), cab)).toContain('Nenhum lançamento neste mês.');
});

test('dashboard em HTML: quadros, 4 gráficos e tabela dos últimos meses', () => {
  const comparativo = caixa.comparativo('2026-11', 3);
  const html = htmlDashboard(resumo, comparativo, {
    linha: graficoLinha(serieDiaria(nov, '2026-11', resumo.saldoAnterior, '2026-11-14'), PALETA_CLARA),
    barras: graficoBarras([{ rotulo: 'Dízimos', centavos: resumo.dizimos, cor: '#1A7A38' }], PALETA_CLARA),
    despesas: null,
    comparativo: graficoComparativo(comparativo, PALETA_CLARA, '2026-11'),
  }, cab);
  expect(html).toContain('Dashboard financeiro - Novembro de 2026');
  expect(html.match(/<svg /g)).toHaveLength(3);
  expect(html).toContain('Nenhuma despesa neste mês.');
  expect(html).toContain('out/26');
  expect(html).toContain('Últimos meses');
});
