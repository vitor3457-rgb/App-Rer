/** Datas de referência são sempre texto "AAAA-MM-DD"; meses são "AAAA-MM". */

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function dois(n: number): string {
  return ('0' + n).slice(-2);
}

/** Data de hoje no fuso do celular. */
export function hojeISO(agora: Date = new Date()): string {
  return agora.getFullYear() + '-' + dois(agora.getMonth() + 1) + '-' + dois(agora.getDate());
}

export function partes(iso: string): { ano: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return { ano, mes, dia };
}

export function ehDataValida(iso: string): boolean {
  return partes(iso) !== null;
}

/** "2026-11-08" -> "08/11/2026" */
export function dataBR(iso: string): string {
  const p = partes(iso);
  return p ? dois(p.dia) + '/' + dois(p.mes) + '/' + p.ano : iso ?? '';
}

/** "2026-11-08" -> "domingo, 8 de novembro de 2026" */
export function dataPorExtenso(iso: string): string {
  const p = partes(iso);
  if (!p) return '';
  const d = new Date(p.ano, p.mes - 1, p.dia);
  return SEMANA[d.getDay()] + ', ' + p.dia + ' de ' + MESES[p.mes - 1].toLowerCase() + ' de ' + p.ano;
}

/** Soma dias a uma data. */
export function somarDias(iso: string, dias: number): string {
  const p = partes(iso);
  if (!p) return iso;
  return hojeISO(new Date(p.ano, p.mes - 1, p.dia + dias));
}

/** "2026-11-08" -> "2026-11" */
export function mesDe(iso: string): string {
  return String(iso ?? '').slice(0, 7);
}

export function mesAtual(agora: Date = new Date()): string {
  return hojeISO(agora).slice(0, 7);
}

/** "2026-12" + 1 -> "2027-01" */
export function somarMeses(mes: string, n: number): string {
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  const total = ano * 12 + (m - 1) + n;
  return Math.floor(total / 12) + '-' + dois((total % 12) + 1);
}

/** "2026-11" -> "Novembro de 2026" */
export function nomeMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] + ' de ' + mes.slice(0, 4);
}

/** "2026-11" -> "nov/26" */
export function nomeMesCurto(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3).toLowerCase() + '/' + mes.slice(2, 4);
}

export function diasNoMes(mes: string): number {
  return new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
}

/** Primeiro dia do mês: "2026-11" -> "2026-11-01" */
export function primeiroDia(mes: string): string {
  return mes + '-01';
}

/** "2026-11-08T14:03:00Z" -> "08/11/2026 11:03" (no fuso do celular) */
export function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + dois(d.getHours()) + ':' + dois(d.getMinutes());
}
