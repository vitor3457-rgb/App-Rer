/** Dinheiro sempre em centavos inteiros (evita erro de arredondamento). */

export const VALOR_MAXIMO_CENTAVOS = 100_000_000; // R$ 1.000.000,00 por lançamento

function doisDigitos(n: number): string {
  return ('0' + n).slice(-2);
}

/** 123456 -> "R$ 1.234,56" · -46175 -> "- R$ 461,75" */
export function formatarReais(centavos: number): string {
  const abs = Math.abs(Math.round(centavos));
  const inteiro = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (centavos < 0 ? '- ' : '') + 'R$ ' + inteiro + ',' + doisDigitos(abs % 100);
}

/** Com sinal: "+ R$ 50,00" / "- R$ 30,00" */
export function formatarComSinal(centavos: number): string {
  return (centavos < 0 ? '- ' : '+ ') + formatarReais(Math.abs(centavos));
}

/**
 * Máscara do campo de valor: os números entram pela direita.
 * "5" -> 5 (R$ 0,05) · "5000" -> 5000 (R$ 50,00) · "R$ 12,34" -> 1234
 */
export function digitosParaCentavos(texto: string, maximoDigitos = 9): number {
  const digitos = String(texto ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, maximoDigitos);
  return digitos ? parseInt(digitos, 10) : 0;
}

/** Texto curto para eixos de gráfico: "R$ 1,2 mil", "R$ 450", "-R$ 2 mil". */
export function reaisCurto(centavos: number): string {
  const reais = centavos / 100;
  const abs = Math.abs(reais);
  const texto =
    abs >= 1000
      ? (abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.', ',').replace(/,0$/, '') + ' mil'
      : String(Math.round(abs));
  return (reais < 0 ? '-' : '') + 'R$ ' + texto;
}

/** Lê um valor vindo de planilha: número (reais) ou texto "1.234,56". Devolve centavos ou null. */
export function lerValorPlanilha(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.round(valor * 100) : null;
  let texto = String(valor ?? '').replace(/R\$|\s/g, '');
  if (!texto) return null;
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  const n = Number(texto);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
