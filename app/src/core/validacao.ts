import { ehDataValida, somarDias, dataBR } from './datas';
import { VALOR_MAXIMO_CENTAVOS, formatarReais } from './dinheiro';
import { limparTexto, listarNomes, normalizar } from './texto';
import { Categoria, Tipo } from './tipos';

export const TAMANHO_MAXIMO_DESCRICAO = 200;
export const DATA_MINIMA = '2020-01-01';
/** Evita datas digitadas errado muito à frente (ex.: 2062). */
export const DIAS_NO_FUTURO = 60;

export type Campo = 'responsavel' | 'valor' | 'tipo' | 'categoria' | 'descricao' | 'contribuinte' | 'data';

export interface Formulario {
  responsavel: string;
  valorCentavos: number;
  tipo: Tipo | '';
  categoria: Categoria | '';
  /** Saída: descrição da despesa. */
  descricao: string;
  /** Entrada: nome de quem contribuiu. */
  contribuinte: string;
  dataReferencia: string;
}

export interface DadosValidados {
  responsavel: string;
  valorCentavos: number;
  tipo: Tipo;
  categoria: Categoria;
  /** Já no formato do banco: despesa (Saída) ou nome de quem contribuiu (Entrada). */
  descricao: string;
  dataReferencia: string;
}

export type Resultado =
  | { ok: true; dados: DadosValidados }
  | { ok: false; erro: string; campo: Campo };

export interface Contexto {
  /** Nomes dos responsáveis ativos. */
  responsaveis: string[];
  /** Data de hoje (AAAA-MM-DD). */
  hoje: string;
}

function falha(erro: string, campo: Campo): Resultado {
  return { ok: false, erro, campo };
}

/** Confere o formulário e devolve os dados prontos para gravar, ou a primeira mensagem de erro. */
export function validarLancamento(f: Formulario, ctx: Contexto): Resultado {
  const responsavel = ctx.responsaveis.find((r) => normalizar(r) === normalizar(f.responsavel));
  if (!responsavel) {
    return falha('Escolha o responsável na lista (' + listarNomes(ctx.responsaveis) + ').', 'responsavel');
  }

  const valor = Number(f.valorCentavos);
  if (!Number.isFinite(valor) || valor <= 0) return falha('Digite o valor (maior que zero).', 'valor');
  if (!Number.isInteger(valor)) return falha('Valor inválido. Use no máximo 2 casas decimais.', 'valor');
  if (valor > VALOR_MAXIMO_CENTAVOS) {
    return falha('Valor muito alto. O máximo por lançamento é ' + formatarReais(VALOR_MAXIMO_CENTAVOS) + '.', 'valor');
  }

  if (f.tipo !== 'Entrada' && f.tipo !== 'Saída') return falha('Escolha se é Entrada ou Saída.', 'tipo');

  let categoria: Categoria;
  let descricao: string;
  if (f.tipo === 'Entrada') {
    if (f.categoria !== 'Dízimo' && f.categoria !== 'Oferta') {
      return falha('Escolha se a entrada é Dízimo ou Oferta.', 'categoria');
    }
    categoria = f.categoria;
    descricao = limparTexto(f.contribuinte);
    if (categoria === 'Dízimo' && !descricao) return falha('Escreva o nome de quem deu o dízimo.', 'contribuinte');
    if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
      return falha('O nome está muito longo (máximo de ' + TAMANHO_MAXIMO_DESCRICAO + ' letras).', 'contribuinte');
    }
  } else {
    categoria = 'Despesa';
    descricao = limparTexto(f.descricao);
    if (!descricao) return falha('Escreva a descrição da despesa (ex.: aluguel, água, luz).', 'descricao');
    if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
      return falha('A descrição está muito longa (máximo de ' + TAMANHO_MAXIMO_DESCRICAO + ' letras).', 'descricao');
    }
  }

  const data = String(f.dataReferencia ?? '').trim();
  if (!data) return falha('Escolha a data do lançamento.', 'data');
  if (!ehDataValida(data)) return falha('Essa data não existe. Confira a data.', 'data');
  if (data < DATA_MINIMA) return falha('A data não pode ser anterior a ' + dataBR(DATA_MINIMA) + '.', 'data');
  const limite = somarDias(ctx.hoje, DIAS_NO_FUTURO);
  if (data > limite) {
    return falha('A data está muito no futuro (' + dataBR(data) + '). Confira o ano e o mês.', 'data');
  }

  return { ok: true, dados: { responsavel, valorCentavos: valor, tipo: f.tipo, categoria, descricao, dataReferencia: data } };
}

/** Confere um e-mail para a lista de usuários. Devolve o e-mail em minúsculas ou null. */
export function validarEmail(texto: string): string | null {
  const email = String(texto ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
