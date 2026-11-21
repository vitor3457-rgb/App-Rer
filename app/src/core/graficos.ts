import { nomeMesCurto } from './datas';
import { formatarReais, reaisCurto } from './dinheiro';
import { Dia, Fatia, ResumoMes } from './totais';

/**
 * Gráficos simples desenhados como texto SVG. O mesmo desenho serve para a tela
 * (componente SvgXml) e para o relatório em PDF (HTML).
 */

export interface Paleta {
  fundo: string;
  tinta: string;
  suave: string;
  grade: string;
  zero: string;
  entrada: string;
  saida: string;
  linha: string;
  area: string;
  /** Verde mais claro (ofertas, ao lado dos dízimos). */
  entradaClara: string;
  /** Cor neutra do saldo guardado em caixa. */
  reserva: string;
}

export const PALETA_CLARA: Paleta = {
  fundo: '#FFFFFF', tinta: '#1C1716', suave: '#6B5F5C', grade: '#E8E2E0', zero: '#9A8F8C',
  entrada: '#1A7A38', saida: '#C0262D', linha: '#C45C00', area: '#FF8708', entradaClara: '#5FB37A', reserva: '#6B5F5C',
};

export const PALETA_ESCURA: Paleta = {
  fundo: '#211D1B', tinta: '#F6F1EE', suave: '#B8ABA6', grade: '#3A3330', zero: '#8A7E79',
  entrada: '#5FD08A', saida: '#FF7B7B', linha: '#FFA94D', area: '#FF8708', entradaClara: '#2F8F55', reserva: '#B8ABA6',
};

export interface Grafico {
  xml: string;
  largura: number;
  altura: number;
}

const FONTE = 'Inter, Roboto, Helvetica, Arial, sans-serif';

/** Cada degradê precisa de um nome único (vários gráficos podem estar na mesma página). */
let serieIds = 0;
function novoId(prefixo: string): string {
  serieIds = (serieIds + 1) % 1_000_000;
  return prefixo + serieIds;
}

function degradeVertical(id: string, cor: string, opacidadeTopo: number): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${cor}" stop-opacity="${opacidadeTopo}"/>` +
    `<stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>`;
}

/** Caminho suave (curvas) passando pelos pontos. */
function curva(pontos: [number, number][]): string {
  if (!pontos.length) return '';
  let d = `M${pontos[0][0].toFixed(1)},${pontos[0][1].toFixed(1)}`;
  for (let i = 1; i < pontos.length; i++) {
    const [x0, y0] = pontos[i - 1];
    const [x1, y1] = pontos[i];
    const meio = (x0 + x1) / 2;
    d += ` C${meio.toFixed(1)},${y0.toFixed(1)} ${meio.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function esc(texto: string): string {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svg(largura: number, altura: number, conteudo: string, p: Paleta): Grafico {
  return {
    largura,
    altura,
    xml:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" font-family="${FONTE}">` +
      `<rect x="0" y="0" width="${largura}" height="${altura}" fill="${p.fundo}"/>` + conteudo + '</svg>',
  };
}

function texto(x: number, y: number, t: string, extra: string): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ${extra}>${esc(t)}</text>`;
}

function cortar(t: string, max: number): string {
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

export interface Barra extends Fatia {
  cor: string;
}

/** Barras horizontais: nome em cima, barra embaixo e o valor escrito no fim da barra. */
export function graficoBarras(barras: Barra[], p: Paleta): Grafico {
  const L = 360;
  const alturaLinha = 46;
  const espacoValor = 116;
  const maximo = Math.max(1, ...barras.map((b) => b.centavos));
  let c = '';
  barras.forEach((b, i) => {
    const y = 2 + i * alturaLinha;
    const w = b.centavos > 0 ? Math.max(4, (b.centavos / maximo) * (L - espacoValor)) : 0;
    c += texto(0, y + 15, cortar(b.rotulo, 36), `font-size="14" font-weight="600" fill="${p.tinta}"`);
    if (w) c += `<rect x="0" y="${y + 22}" width="${w.toFixed(1)}" height="16" rx="4" fill="${b.cor}"/>`;
    c += texto(w + (w ? 8 : 0), y + 35, formatarReais(b.centavos), `font-size="14" font-weight="700" fill="${p.tinta}"`);
  });
  return svg(L, 6 + barras.length * alturaLinha, c, p);
}

function passoBonito(bruto: number): number {
  const potencia = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1))));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * potencia >= bruto) return m * potencia;
  return 10 * potencia;
}

function escala(minimo: number, maximo: number, divisoes: number) {
  if (maximo === minimo) maximo = minimo + 10000;
  const passo = passoBonito((maximo - minimo) / divisoes);
  const inicio = Math.floor(minimo / passo) * passo;
  const fim = Math.ceil(maximo / passo) * passo;
  const marcas: number[] = [];
  for (let v = inicio; v <= fim + passo / 1000; v += passo) marcas.push(Math.round(v));
  return { inicio, fim, marcas };
}

export interface GraficoLinha extends Grafico {
  /** Posição horizontal (em unidades do desenho) do dia de índice i. */
  px: (i: number) => number;
  py: (centavos: number) => number;
}

/** Linha do saldo em caixa ao longo do mês, com o zero em destaque. */
export function graficoLinha(dias: Dia[], p: Paleta): GraficoLinha {
  const L = 360, A = 190, esq = 64, dir = 14, cima = 16, baixo = 26;
  const valores = dias.map((d) => d.saldo);
  const e = escala(Math.min(0, ...valores), Math.max(0, ...valores), 3);
  const n = Math.max(dias.length, 2);
  const px = (i: number) => esq + (i / (n - 1)) * (L - esq - dir);
  const py = (v: number) => cima + (1 - (v - e.inicio) / (e.fim - e.inicio)) * (A - cima - baixo);

  let c = '';
  for (const v of e.marcas) {
    const y = py(v).toFixed(1);
    c += `<line x1="${esq}" x2="${L - dir}" y1="${y}" y2="${y}" stroke="${v === 0 ? p.zero : p.grade}" stroke-width="${v === 0 ? 1.5 : 1}"/>`;
    c += texto(esq - 6, py(v) + 4, reaisCurto(v), `font-size="11" text-anchor="end" fill="${p.suave}"`);
  }
  const marcasDia = [1, 5, 10, 15, 20, 25, dias.length].filter(
    (d, i, a) => d <= dias.length && a.indexOf(d) === i && !(d !== dias.length && dias.length - d < 3),
  );
  for (const d of marcasDia) c += texto(px(d - 1), A - 8, 'dia ' + d, `font-size="11" text-anchor="middle" fill="${p.suave}"`);

  const pontos: [number, number][] = dias.map((d, i) => [px(i), py(d.saldo)]);
  if (dias.length === 1) pontos.push([px(1), py(dias[0].saldo)]);
  const zeroY = py(0).toFixed(1);
  const ultimoX = px(Math.max(dias.length - 1, 1)).toFixed(1);
  if (pontos.length) {
    const id = novoId('caixa');
    const linha = curva(pontos);
    c += degradeVertical(id, p.area, 0.38);
    c += `<path d="${linha} L${ultimoX},${zeroY} L${px(0).toFixed(1)},${zeroY} Z" fill="url(#${id})"/>`;
    c += `<path d="${linha}" fill="none" stroke="${p.linha}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  dias.forEach((d, i) => {
    if (d.temLancamento) c += `<circle cx="${px(i).toFixed(1)}" cy="${py(d.saldo).toFixed(1)}" r="4" fill="${p.linha}" stroke="${p.fundo}" stroke-width="2"/>`;
  });
  const ultimo = dias[dias.length - 1];
  if (ultimo) {
    c += texto(L - dir, Math.max(12, py(ultimo.saldo) - 10), formatarReais(ultimo.saldo), `font-size="12" font-weight="700" text-anchor="end" fill="${p.tinta}"`);
  }
  return { ...svg(L, A, c, p), px, py };
}

/** Entradas x saídas dos últimos meses (barras lado a lado), com legenda. */
export function graficoComparativo(meses: ResumoMes[], p: Paleta, mesDestacado?: string): Grafico {
  const L = 360, A = 200, esq = 58, dir = 8, cima = 30, baixo = 26;
  const e = escala(0, Math.max(1, ...meses.map((m) => Math.max(m.entradas, m.saidas))), 3);
  const py = (v: number) => cima + (1 - v / e.fim) * (A - cima - baixo);
  const base = py(0);
  const faixa = (L - esq - dir) / Math.max(meses.length, 1);
  const largura = Math.min(18, faixa / 2 - 3);

  let c = '';
  // legenda
  c += `<rect x="${esq}" y="6" width="12" height="12" rx="3" fill="${p.entrada}"/>` + texto(esq + 17, 16, 'Entradas', `font-size="12" font-weight="600" fill="${p.tinta}"`);
  c += `<rect x="${esq + 90}" y="6" width="12" height="12" rx="3" fill="${p.saida}"/>` + texto(esq + 107, 16, 'Saídas', `font-size="12" font-weight="600" fill="${p.tinta}"`);
  for (const v of e.marcas) {
    const y = py(v).toFixed(1);
    c += `<line x1="${esq}" x2="${L - dir}" y1="${y}" y2="${y}" stroke="${v === 0 ? p.zero : p.grade}" stroke-width="1"/>`;
    c += texto(esq - 6, py(v) + 4, reaisCurto(v), `font-size="11" text-anchor="end" fill="${p.suave}"`);
  }
  const barra = (x: number, v: number, cor: string) => {
    if (v <= 0) return '';
    const h = Math.max(2, base - py(v));
    const r = Math.min(4, h);
    // cantos arredondados só em cima (a base fica reta, apoiada no eixo)
    return `<path d="M${x.toFixed(1)},${base.toFixed(1)} v${(-(h - r)).toFixed(1)} q0,${-r} ${r},${-r} h${(largura - 2 * r).toFixed(1)} q${r},0 ${r},${r} v${(h - r).toFixed(1)} z" fill="${cor}"/>`;
  };
  meses.forEach((m, i) => {
    const centro = esq + faixa * (i + 0.5);
    c += barra(centro - largura - 1, m.entradas, p.entrada);
    c += barra(centro + 1, m.saidas, p.saida);
    const destaque = m.mes === mesDestacado;
    c += texto(centro, A - 8, nomeMesCurto(m.mes), `font-size="11" text-anchor="middle" font-weight="${destaque ? 700 : 400}" fill="${destaque ? p.tinta : p.suave}"`);
  });
  return svg(L, A, c, p);
}

/** Versão pequena da linha do caixa (tela inicial): só a curva com degradê e o último valor marcado. */
export function graficoLinhaMini(dias: Dia[], p: Paleta): Grafico {
  const L = 320, A = 90, margem = 8;
  const valores = dias.map((d) => d.saldo);
  let minimo = Math.min(...valores, 0);
  let maximo = Math.max(...valores, 0);
  if (maximo === minimo) { maximo += 1; minimo -= 1; }
  const n = Math.max(dias.length, 2);
  const px = (i: number) => margem + (i / (n - 1)) * (L - 2 * margem);
  const py = (v: number) => margem + (1 - (v - minimo) / (maximo - minimo)) * (A - 2 * margem);
  const pontos: [number, number][] = dias.map((d, i) => [px(i), py(d.saldo)]);
  if (dias.length === 1) pontos.push([px(1), py(dias[0].saldo)]);
  let c = '';
  if (pontos.length) {
    const id = novoId('mini');
    const linha = curva(pontos);
    const ultimo = pontos[pontos.length - 1];
    c += degradeVertical(id, p.area, 0.38);
    c += `<path d="${linha} L${ultimo[0].toFixed(1)},${A} L${pontos[0][0].toFixed(1)},${A} Z" fill="url(#${id})"/>`;
    c += `<path d="${linha}" fill="none" stroke="${p.linha}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    c += `<circle cx="${ultimo[0].toFixed(1)}" cy="${ultimo[1].toFixed(1)}" r="5" fill="${p.linha}" stroke="${p.fundo}" stroke-width="2"/>`;
  }
  return svg(L, A, c, p);
}

export interface FatiaRosca {
  rotulo: string;
  centavos: number;
  cor: string;
}

/** Gráfico de rosca com legenda ao lado (valores escritos, a cor nunca é a única informação). */
export function graficoRosca(fatias: FatiaRosca[], centro: { titulo: string; valor: string; cor?: string }, p: Paleta): Grafico {
  const L = 360, A = 150, cx = 72, cy = 75, raio = 52, espessura = 20;
  const total = fatias.reduce((s, f) => s + Math.max(0, f.centavos), 0);
  const volta = 2 * Math.PI * raio;
  let c = `<circle cx="${cx}" cy="${cy}" r="${raio}" fill="none" stroke="${p.grade}" stroke-width="${espessura}"/>`;
  let andado = 0;
  const visiveis = fatias.filter((f) => f.centavos > 0);
  for (const f of visiveis) {
    const parte = (f.centavos / total) * volta;
    // 2 unidades de folga entre as fatias (quando há mais de uma)
    const tamanho = Math.max(0.5, parte - (visiveis.length > 1 ? 2 : 0));
    c += `<circle cx="${cx}" cy="${cy}" r="${raio}" fill="none" stroke="${f.cor}" stroke-width="${espessura}" ` +
      `stroke-dasharray="${tamanho.toFixed(2)} ${(volta - tamanho).toFixed(2)}" stroke-dashoffset="${(-andado).toFixed(2)}" ` +
      `transform="rotate(-90 ${cx} ${cy})"/>`;
    andado += parte;
  }
  c += texto(cx, cy - 4, centro.titulo, `font-size="11" text-anchor="middle" fill="${p.suave}"`);
  c += texto(cx, cy + 13, centro.valor, `font-size="12.5" font-weight="700" text-anchor="middle" fill="${centro.cor ?? p.tinta}"`);
  const x = 150;
  const topo = cy - (fatias.length * 26) / 2 + 13;
  fatias.forEach((f, i) => {
    const y = topo + i * 26;
    c += `<circle cx="${x + 6}" cy="${y - 4}" r="6" fill="${f.cor}"/>`;
    c += texto(x + 18, y, cortar(f.rotulo, 20), `font-size="13" fill="${p.tinta}"`);
    c += texto(L - 4, y, formatarReais(f.centavos), `font-size="13" font-weight="700" text-anchor="end" fill="${p.tinta}"`);
  });
  return svg(L, A, c, p);
}
