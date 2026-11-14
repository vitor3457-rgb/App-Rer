import {
  dataBR, dataPorExtenso, diasNoMes, ehDataValida, hojeISO, mesDe, nomeMes, nomeMesCurto, somarDias, somarMeses,
} from '../datas';
import { digitosParaCentavos, formatarComSinal, formatarReais, lerValorPlanilha, reaisCurto } from '../dinheiro';
import { limparTexto, listarNomes, normalizar, semRepetir, sugerir } from '../texto';

describe('dinheiro', () => {
  test('formata reais', () => {
    expect(formatarReais(0)).toBe('R$ 0,00');
    expect(formatarReais(5)).toBe('R$ 0,05');
    expect(formatarReais(5000)).toBe('R$ 50,00');
    expect(formatarReais(123456789)).toBe('R$ 1.234.567,89');
    expect(formatarReais(-46175)).toBe('- R$ 461,75');
    expect(formatarComSinal(5000)).toBe('+ R$ 50,00');
    expect(formatarComSinal(-3000)).toBe('- R$ 30,00');
  });

  test('máscara: números entram pela direita', () => {
    expect(digitosParaCentavos('5')).toBe(5);
    expect(digitosParaCentavos('5000')).toBe(5000);
    expect(digitosParaCentavos('R$ 12,34')).toBe(1234);
    expect(digitosParaCentavos('R$ 0,05')).toBe(5);
    expect(digitosParaCentavos('abc')).toBe(0);
    expect(digitosParaCentavos('')).toBe(0);
    expect(digitosParaCentavos('1234567899')).toBe(123456789); // corta no limite de dígitos
  });

  test('texto curto para gráficos', () => {
    expect(reaisCurto(45000)).toBe('R$ 450');
    expect(reaisCurto(120000)).toBe('R$ 1,2 mil');
    expect(reaisCurto(100000)).toBe('R$ 1 mil');
    expect(reaisCurto(-200000)).toBe('-R$ 2 mil');
    expect(reaisCurto(2500000)).toBe('R$ 25 mil');
  });

  test('lê valores da planilha antiga', () => {
    expect(lerValorPlanilha(123.45)).toBe(12345);
    expect(lerValorPlanilha(0.1 + 0.2)).toBe(30);
    expect(lerValorPlanilha('1.234,50')).toBe(123450);
    expect(lerValorPlanilha('R$ 50,00')).toBe(5000);
    expect(lerValorPlanilha('')).toBeNull();
    expect(lerValorPlanilha('abc')).toBeNull();
  });
});

describe('datas', () => {
  test('hoje no fuso do celular', () => {
    expect(hojeISO(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
    expect(hojeISO(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  test('validação e formatos', () => {
    expect(ehDataValida('2026-11-08')).toBe(true);
    expect(ehDataValida('2026-02-30')).toBe(false);
    expect(ehDataValida('2026-13-01')).toBe(false);
    expect(ehDataValida('08/11/2026')).toBe(false);
    expect(dataBR('2026-11-08')).toBe('08/11/2026');
    expect(dataPorExtenso('2026-11-08')).toBe('domingo, 8 de novembro de 2026');
    expect(dataPorExtenso('xx')).toBe('');
  });

  test('contas com meses e dias', () => {
    expect(mesDe('2026-11-08')).toBe('2026-11');
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(somarMeses('2026-11', -5)).toBe('2026-06');
    expect(somarMeses('2026-11', 14)).toBe('2028-01');
    expect(nomeMes('2026-11')).toBe('Novembro de 2026');
    expect(nomeMesCurto('2026-03')).toBe('mar/26');
    expect(diasNoMes('2026-02')).toBe(28);
    expect(diasNoMes('2028-02')).toBe(29);
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-11-08', 60)).toBe('2027-01-07');
  });
});

describe('texto', () => {
  test('normalizar e limpar', () => {
    expect(normalizar('  Lázaro  DA Silva ')).toBe('lazaro da silva');
    expect(limparTexto('  Conta   de\tluz \n')).toBe('Conta de luz');
    expect(listarNomes(['Alex', 'Júlio', 'Lázaro'])).toBe('Alex, Júlio ou Lázaro');
    expect(listarNomes(['Alex'])).toBe('Alex');
  });

  test('sugestões filtram sem acento e põem primeiro quem começa com o termo', () => {
    const nomes = ['Silvana', 'Gabriel', 'Ana Silva', 'Lázaro'];
    expect(sugerir(nomes, '')).toEqual(nomes);
    expect(sugerir(nomes, 'sil')).toEqual(['Silvana', 'Ana Silva']);
    expect(sugerir(nomes, 'LAZ')).toEqual(['Lázaro']);
    expect(sugerir(nomes, 'silvana')).toEqual([]); // já está escrito igual
    expect(sugerir(nomes, 'xyz')).toEqual([]);
    expect(sugerir(nomes, '', 2)).toEqual(['Silvana', 'Gabriel']);
  });

  test('junta listas sem repetir', () => {
    expect(semRepetir(['Aluguel', 'Água'], ['agua', 'Gás', 'ALUGUEL'])).toEqual(['Aluguel', 'Água', 'Gás']);
  });
});
