import { Formulario, validarEmail, validarLancamento } from '../validacao';

const ctx = { responsaveis: ['Alex', 'Júlio', 'Lázaro'], hoje: '2026-11-08' };

function form(extra: Partial<Formulario> = {}): Formulario {
  return {
    responsavel: 'Alex', valorCentavos: 5000, tipo: 'Entrada', categoria: 'Dízimo',
    descricao: '', contribuinte: 'Silvana', dataReferencia: '2026-11-08', ...extra,
  };
}

function erro(extra: Partial<Formulario>) {
  const r = validarLancamento(form(extra), ctx);
  if (r.ok) throw new Error('deveria falhar: ' + JSON.stringify(extra));
  return r;
}

describe('validarLancamento', () => {
  test('entrada válida: a descrição gravada é o nome de quem contribuiu', () => {
    const r = validarLancamento(form({ contribuinte: '  Silvana   Souza ', descricao: 'ignorar' }), ctx);
    expect(r).toEqual({
      ok: true,
      dados: {
        responsavel: 'Alex', valorCentavos: 5000, tipo: 'Entrada', categoria: 'Dízimo',
        descricao: 'Silvana Souza', dataReferencia: '2026-11-08',
      },
    });
  });

  test('saída válida: categoria vira Despesa e o nome do contribuinte é ignorado', () => {
    const r = validarLancamento(form({ tipo: 'Saída', categoria: '', descricao: ' Conta  de luz ', contribuinte: 'x' }), ctx);
    expect(r.ok && r.dados).toMatchObject({ tipo: 'Saída', categoria: 'Despesa', descricao: 'Conta de luz' });
  });

  test('responsável: aceita sem acento e devolve o nome da lista', () => {
    const r = validarLancamento(form({ responsavel: ' lazaro ' }), ctx);
    expect(r.ok && r.dados.responsavel).toBe('Lázaro');
    expect(erro({ responsavel: 'Pedro' })).toMatchObject({ campo: 'responsavel', erro: 'Escolha o responsável na lista (Alex, Júlio ou Lázaro).' });
    expect(erro({ responsavel: '' }).campo).toBe('responsavel');
  });

  test('valor', () => {
    expect(erro({ valorCentavos: 0 })).toMatchObject({ campo: 'valor', erro: 'Digite o valor (maior que zero).' });
    expect(erro({ valorCentavos: -5 }).campo).toBe('valor');
    expect(erro({ valorCentavos: NaN }).campo).toBe('valor');
    expect(erro({ valorCentavos: 10.5 }).erro).toMatch(/2 casas decimais/);
    expect(erro({ valorCentavos: 100000001 }).erro).toMatch(/Valor muito alto.*R\$ 1\.000\.000,00/);
    expect(validarLancamento(form({ valorCentavos: 100000000 }), ctx).ok).toBe(true);
  });

  test('tipo e categoria', () => {
    expect(erro({ tipo: '' })).toMatchObject({ campo: 'tipo', erro: 'Escolha se é Entrada ou Saída.' });
    expect(erro({ categoria: '' })).toMatchObject({ campo: 'categoria', erro: 'Escolha se a entrada é Dízimo ou Oferta.' });
    expect(erro({ categoria: 'Despesa' }).campo).toBe('categoria');
  });

  test('nome é obrigatório no dízimo e opcional na oferta', () => {
    expect(erro({ contribuinte: '   ' })).toMatchObject({ campo: 'contribuinte', erro: 'Escreva o nome de quem deu o dízimo.' });
    const r = validarLancamento(form({ categoria: 'Oferta', contribuinte: '' }), ctx);
    expect(r.ok && r.dados.descricao).toBe('');
  });

  test('descrição da despesa é obrigatória e tem limite', () => {
    expect(erro({ tipo: 'Saída', descricao: '  ' })).toMatchObject({ campo: 'descricao' });
    expect(erro({ tipo: 'Saída', descricao: 'x'.repeat(201) }).erro).toMatch(/muito longa/);
    expect(erro({ contribuinte: 'x'.repeat(201) }).erro).toMatch(/nome está muito longo/);
  });

  test('data', () => {
    expect(erro({ dataReferencia: '' })).toMatchObject({ campo: 'data', erro: 'Escolha a data do lançamento.' });
    expect(erro({ dataReferencia: '2026-02-30' }).erro).toMatch(/não existe/);
    expect(erro({ dataReferencia: '2019-12-31' }).erro).toMatch(/anterior a 01\/01\/2020/);
    expect(erro({ dataReferencia: '2062-11-08' }).erro).toMatch(/muito no futuro/);
    expect(validarLancamento(form({ dataReferencia: '2027-01-07' }), ctx).ok).toBe(true); // 60 dias à frente
    expect(erro({ dataReferencia: '2027-01-08' }).campo).toBe('data');
    expect(validarLancamento(form({ dataReferencia: '2025-12-31' }), ctx).ok).toBe(true); // anos anteriores valem
  });
});

test('validarEmail', () => {
  expect(validarEmail('  Tesoureiro@Gmail.com ')).toBe('tesoureiro@gmail.com');
  expect(validarEmail('sem-arroba')).toBeNull();
  expect(validarEmail('a@b')).toBeNull();
  expect(validarEmail('')).toBeNull();
});
