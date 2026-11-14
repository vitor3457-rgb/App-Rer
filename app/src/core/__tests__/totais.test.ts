import {
  agruparPorMes, calcularCaixa, despesasPrincipais, filtrar, historicoDoMembro, maisUsados, ordenarRecentes,
  serieDiaria, totalizar,
} from '../totais';
import { lanc, membro, saida } from './fabrica';

describe('totalizar', () => {
  test('separa dízimos, ofertas e saídas; ignora excluídos', () => {
    const t = totalizar([
      lanc({ valorCentavos: 10010 }),
      lanc({ categoria: 'Oferta', descricao: '', valorCentavos: 2050 }),
      lanc({ valorCentavos: 20000 }),
      saida('Aluguel', 15000),
      lanc({ valorCentavos: 99999, excluidoEm: '2026-11-09T00:00:00Z' }),
    ]);
    expect(t).toEqual({ dizimos: 30010, ofertas: 2050, entradas: 32060, saidas: 15000, resultado: 17060, quantidade: 4 });
  });

  test('centavos não sofrem erro de arredondamento', () => {
    expect(totalizar([lanc({ valorCentavos: 10 }), lanc({ valorCentavos: 20 })]).entradas).toBe(30);
  });
});

describe('caixa acumulado (o mês começa com o saldo do anterior)', () => {
  const dados = [
    lanc({ dataReferencia: '2026-10-05', valorCentavos: 100000 }),
    saida('Aluguel', 80000, { dataReferencia: '2026-10-10' }),
    lanc({ dataReferencia: '2026-11-01', valorCentavos: 50000 }),
    saida('Luz', 20000, { dataReferencia: '2026-11-15' }),
    saida('Reforma', 90000, { dataReferencia: '2027-01-20' }),
  ];

  test('novembro abre com o que sobrou de outubro', () => {
    const caixa = calcularCaixa(agruparPorMes(dados), 0);
    expect(caixa.resumoDoMes('2026-10')).toMatchObject({ saldoAnterior: 0, entradas: 100000, saidas: 80000, resultado: 20000, saldoCaixa: 20000 });
    expect(caixa.resumoDoMes('2026-11')).toMatchObject({ saldoAnterior: 20000, resultado: 30000, saldoCaixa: 50000 });
  });

  test('mês sem lançamentos carrega o saldo (dezembro) e a virada de ano continua a conta', () => {
    const caixa = calcularCaixa(agruparPorMes(dados), 0);
    expect(caixa.resumoDoMes('2026-12')).toMatchObject({ saldoAnterior: 50000, entradas: 0, saidas: 0, saldoCaixa: 50000, quantidade: 0 });
    expect(caixa.resumoDoMes('2027-01')).toMatchObject({ saldoAnterior: 50000, saldoCaixa: -40000 });
    expect(caixa.resumoDoMes('2027-06').saldoCaixa).toBe(-40000);
    expect(caixa.saldoAtual).toBe(-40000);
  });

  test('saldo de abertura entra antes do primeiro mês', () => {
    const caixa = calcularCaixa(agruparPorMes(dados), 150000);
    expect(caixa.resumoDoMes('2026-09')).toMatchObject({ saldoAnterior: 150000, saldoCaixa: 150000 });
    expect(caixa.resumoDoMes('2026-10').saldoAnterior).toBe(150000);
    expect(caixa.resumoDoMes('2026-11').saldoCaixa).toBe(200000);
  });

  test('sem nenhum lançamento, o caixa é o saldo de abertura', () => {
    const caixa = calcularCaixa(agruparPorMes([]), 12345);
    expect(caixa.resumoDoMes('2026-11')).toMatchObject({ saldoAnterior: 12345, saldoCaixa: 12345 });
    expect(caixa.primeiroMes).toBeNull();
  });

  test('excluídos não contam no caixa', () => {
    const caixa = calcularCaixa(agruparPorMes([...dados, lanc({ dataReferencia: '2026-10-01', valorCentavos: 999999, excluidoEm: 'x' })]), 0);
    expect(caixa.resumoDoMes('2026-10').saldoCaixa).toBe(20000);
  });

  test('comparativo dos últimos meses (do mais antigo para o mais novo)', () => {
    const caixa = calcularCaixa(agruparPorMes(dados), 0);
    const c = caixa.comparativo('2026-12', 3);
    expect(c.map((r) => r.mes)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(c.map((r) => r.saldoCaixa)).toEqual([20000, 50000, 50000]);
  });
});

test('ordenarRecentes: data mais nova primeiro; no mesmo dia, o lançado por último', () => {
  const a = lanc({ dataReferencia: '2026-11-01' });
  const b = lanc({ dataReferencia: '2026-11-15', criadoEm: '2026-11-15T10:00:00Z' });
  const c = lanc({ dataReferencia: '2026-11-15', criadoEm: '2026-11-15T11:00:00Z' });
  expect(ordenarRecentes([a, b, c]).map((l) => l.id)).toEqual([c.id, b.id, a.id]);
});

describe('filtrar', () => {
  const lista = [
    lanc({ descricao: 'Silvana', valorCentavos: 5000 }),
    lanc({ descricao: 'Lázaro Souza', categoria: 'Oferta', valorCentavos: 123456, responsavel: 'Júlio' }),
    saida('Conta de luz', 12735),
  ];
  test('busca por texto sem acento, por tipo, categoria e responsável', () => {
    expect(filtrar(lista, { busca: 'lazaro' })).toHaveLength(1);
    expect(filtrar(lista, { busca: 'LUZ' })).toHaveLength(1);
    expect(filtrar(lista, { tipo: 'Saída' })).toHaveLength(1);
    expect(filtrar(lista, { categoria: 'Oferta' })).toHaveLength(1);
    expect(filtrar(lista, { responsavel: 'julio' })).toHaveLength(1);
    expect(filtrar(lista, { busca: 'dizimo', tipo: 'Entrada' })).toHaveLength(1);
    expect(filtrar(lista, {})).toHaveLength(3);
    expect(filtrar(lista, { busca: 'nada' })).toHaveLength(0);
  });
  test('busca por valor', () => {
    expect(filtrar(lista, { busca: '50' }).map((l) => l.descricao)).toEqual(['Silvana']);
    expect(filtrar(lista, { busca: '127,35' })).toHaveLength(1);
    expect(filtrar(lista, { busca: '1234' })).toHaveLength(1);
  });
});

describe('serieDiaria', () => {
  const doMes = [
    lanc({ dataReferencia: '2026-11-01', valorCentavos: 50000 }),
    saida('Luz', 20000, { dataReferencia: '2026-11-03' }),
    lanc({ dataReferencia: '2026-11-03', valorCentavos: 1000 }),
  ];
  test('no mês atual vai até hoje e parte do saldo anterior', () => {
    const dias = serieDiaria(doMes, '2026-11', 10000, '2026-11-05');
    expect(dias).toHaveLength(5);
    expect(dias.map((d) => d.saldo)).toEqual([60000, 60000, 41000, 41000, 41000]);
    expect(dias[2]).toMatchObject({ dia: 3, entrou: 1000, saiu: 20000, temLancamento: true });
    expect(dias[1].temLancamento).toBe(false);
  });
  test('em mês passado vai até o último dia; lançamento futuro estica o mês atual', () => {
    expect(serieDiaria(doMes, '2026-11', 0, '2026-12-10')).toHaveLength(30);
    expect(serieDiaria([lanc({ dataReferencia: '2026-11-20' })], '2026-11', 0, '2026-11-05')).toHaveLength(20);
  });
});

test('despesasPrincipais agrupa por descrição e junta o resto em "Outras"', () => {
  const doMes = [
    saida('Aluguel', 80000), saida('Luz', 12000), saida('luz', 3000), saida('Água', 9000),
    saida('Internet', 10000), saida('Gás', 1000), saida('Café', 500), lanc({ valorCentavos: 999999 }),
  ];
  expect(despesasPrincipais(doMes, 4)).toEqual([
    { rotulo: 'Aluguel', centavos: 80000 },
    { rotulo: 'Luz', centavos: 15000 },
    { rotulo: 'Internet', centavos: 10000 },
    { rotulo: 'Água', centavos: 9000 },
    { rotulo: 'Outras (2)', centavos: 1500 },
  ]);
  expect(despesasPrincipais([saida('A', 1), saida('B', 2)], 4)).toHaveLength(2);
  expect(despesasPrincipais([lanc()], 4)).toEqual([]);
});

test('maisUsados ordena pela frequência, sem diferenciar acento/maiúscula', () => {
  expect(maisUsados(['Gás', 'Aluguel', 'gas', 'Pintura', 'GÁS', 'aluguel', ''])).toEqual(['Gás', 'Aluguel', 'Pintura']);
});

test('historicoDoMembro: pelo cadastro e, nos antigos, pelo mesmo nome', () => {
  const silvana = membro('Silvana');
  const outra = membro('Silvana Souza');
  const lista = [
    lanc({ membroId: silvana.id, valorCentavos: 10000, dataReferencia: '2026-10-05' }),
    lanc({ membroId: null, descricao: 'silvana', valorCentavos: 5000, dataReferencia: '2026-11-02' }),
    lanc({ membroId: silvana.id, categoria: 'Oferta', valorCentavos: 2000, dataReferencia: '2026-11-08' }),
    lanc({ membroId: outra.id, descricao: 'Silvana Souza', valorCentavos: 70000 }),
    lanc({ membroId: silvana.id, valorCentavos: 999, excluidoEm: 'x' }),
    saida('Silvana', 100),
  ];
  const h = historicoDoMembro(lista, silvana);
  expect(h).toMatchObject({ quantidade: 3, totalCentavos: 17000, dizimosCentavos: 15000, ofertasCentavos: 2000, ultimaData: '2026-11-08' });
  expect(h.itens[0].dataReferencia).toBe('2026-11-08');
});
