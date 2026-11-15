import * as XLSX from 'xlsx';

import { dataBR, dataHoraBR, nomeMes, nomeMesCurto } from './datas';
import { formatarComSinal, formatarReais } from './dinheiro';
import { Grafico } from './graficos';
import { ResumoMes, ordenarAntigos } from './totais';
import { Lancamento } from './tipos';

/** Relatórios do mês: planilha Excel e páginas (HTML) que viram PDF. */

export interface Cabecalho {
  nomeApp: string;
  nomeCompleto: string;
  /** Logo como "data:image/png;base64,..." */
  logo: string;
  geradoPor: string;
  /** Texto pronto, ex.: "14/11/2026 15:00" */
  geradoEm: string;
}

export function nomeArquivo(nomeApp: string, tipo: 'lancamentos' | 'relatorio' | 'dashboard', mes: string, extensao: string): string {
  return nomeApp.replace(/[^A-Za-z0-9_-]+/g, '') + '-' + tipo + '-' + mes + '.' + extensao;
}

// ------------------------------------------------------------------ Excel

/** Data no formato do Excel (dias desde 30/12/1899), sem depender de fuso. */
function dataExcel(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0): number {
  return (Date.UTC(ano, mes - 1, dia, hora, minuto, segundo) - Date.UTC(1899, 11, 30)) / 86400000;
}

export const COLUNAS_EXCEL = [
  'ID', 'Data/hora do lançamento', 'Data de referência', 'Ano', 'Mês', 'Tipo', 'Categoria',
  'Descrição', 'Valor', 'Usuário', 'Responsável', 'Tem foto', 'Forma de pagamento', 'Observação',
];

/** Monta a planilha do mês (aba "Lançamentos" + aba "Resumo") e devolve o arquivo em base64. */
export function gerarExcel(itens: Lancamento[], resumo: ResumoMes, cab: Cabecalho): string {
  const linhas: (string | number)[][] = [COLUNAS_EXCEL];
  for (const l of ordenarAntigos(itens)) {
    const criado = new Date(l.criadoEm);
    const [ano, mes, dia] = l.dataReferencia.split('-').map(Number);
    linhas.push([
      l.id,
      isNaN(criado.getTime()) ? '' : dataExcel(criado.getFullYear(), criado.getMonth() + 1, criado.getDate(), criado.getHours(), criado.getMinutes(), criado.getSeconds()),
      dataExcel(ano, mes, dia),
      ano, mes, l.tipo, l.categoria, l.descricao,
      l.valorCentavos / 100,
      l.usuarioEmail, l.responsavel, l.comprovante ? 'Sim' : '', l.formaPagamento ?? '', l.observacao ?? '',
    ]);
  }
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  const formato = (linha: number, coluna: number, z: string) => {
    const celula = aba[XLSX.utils.encode_cell({ r: linha, c: coluna })];
    if (celula && celula.t === 'n') celula.z = z;
  };
  for (let i = 1; i < linhas.length; i++) {
    formato(i, 1, 'dd/mm/yyyy hh:mm');
    formato(i, 2, 'dd/mm/yyyy');
    formato(i, 8, '#,##0.00');
  }
  aba['!cols'] = [38, 20, 14, 6, 5, 9, 10, 32, 12, 28, 13, 9, 18, 40].map((wch) => ({ wch }));
  aba['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length - 1, c: COLUNAS_EXCEL.length - 1 } }) };

  const abaResumo = XLSX.utils.aoa_to_sheet([
    [cab.nomeApp + ' - ' + cab.nomeCompleto],
    ['Lançamentos de ' + nomeMes(resumo.mes)],
    [],
    ['Saldo anterior', resumo.saldoAnterior / 100],
    ['Dízimos', resumo.dizimos / 100],
    ['Ofertas', resumo.ofertas / 100],
    ['Total de entradas', resumo.entradas / 100],
    ['Total de saídas', resumo.saidas / 100],
    ['Resultado do mês', resumo.resultado / 100],
    ['Saldo em caixa', resumo.saldoCaixa / 100],
    [],
    ['Quantidade de lançamentos', resumo.quantidade],
    ['Gerado em', cab.geradoEm],
    ['Gerado por', cab.geradoPor],
  ]);
  for (let i = 3; i <= 9; i++) {
    const celula = abaResumo[XLSX.utils.encode_cell({ r: i, c: 1 })];
    if (celula) celula.z = '"R$" #,##0.00';
  }
  abaResumo['!cols'] = [{ wch: 28 }, { wch: 22 }];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, aba, 'Lançamentos');
  XLSX.utils.book_append_sheet(livro, abaResumo, 'Resumo');
  return XLSX.write(livro, { bookType: 'xlsx', type: 'base64', compression: true });
}

// ------------------------------------------------------------------ HTML → PDF

function esc(texto: string): string {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ESTILO = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1c1716; font-size: 11pt; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .topo { display: flex; align-items: center; gap: 14pt; border-bottom: 3pt solid #ff8708; padding-bottom: 8pt; margin-bottom: 12pt; }
  .topo img { height: 62pt; }
  .topo h1 { font-size: 20pt; margin: 0; letter-spacing: 1pt; }
  .topo .igreja { color: #6b5f5c; font-size: 10pt; margin: 1pt 0 4pt; }
  .topo .titulo { font-weight: bold; font-size: 13pt; }
  h2 { font-size: 12pt; margin: 14pt 0 6pt; }
  table { border-collapse: collapse; width: 100%; }
  .resumo { width: 62%; }
  .resumo td { padding: 4pt 6pt; border-bottom: 0.5pt solid #e8e2e0; }
  .resumo td:last-child, .num { text-align: right; font-weight: bold; white-space: nowrap; }
  .resumo .sub td:first-child { padding-left: 16pt; color: #6b5f5c; }
  .resumo .caixa td { font-size: 12.5pt; border-bottom: none; }
  .lista th { background: #4f4643; color: #fff; text-align: left; padding: 5pt 6pt; font-size: 9.5pt; }
  .lista td { padding: 4.5pt 6pt; font-size: 9.5pt; vertical-align: top; border-bottom: 0.5pt solid #e8e2e0; }
  .lista tr:nth-child(even) td { background: #f6f3f2; }
  .lista tr { page-break-inside: avoid; }
  .verde { color: #1a7a38; } .vermelho { color: #c0262d; }
  .fundo-verde { background: #e3f4e8; } .fundo-vermelho { background: #fde9ea; }
  .quadros { display: flex; gap: 8pt; }
  .quadro { flex: 1; background: #f6f3f2; border: 0.5pt solid #d8cfcc; border-radius: 6pt; padding: 7pt 8pt; }
  .quadro span { display: block; color: #6b5f5c; font-size: 8.5pt; }
  .quadro strong { font-size: 12pt; white-space: nowrap; }
  .duas { display: flex; gap: 14pt; } .duas > div { flex: 1; min-width: 0; }
  .grafico svg { width: 100%; height: auto; display: block; }
  .bloco { page-break-inside: avoid; }
  .rodape { margin-top: 16pt; color: #6b5f5c; font-size: 8pt; border-top: 0.5pt solid #e8e2e0; padding-top: 5pt; }
`;

function pagina(titulo: string, cab: Cabecalho, corpo: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>
<div class="topo"><img src="${cab.logo}" alt=""><div>
<h1>${esc(cab.nomeApp)}</h1><div class="igreja">${esc(cab.nomeCompleto)}</div><div class="titulo">${esc(titulo)}</div></div></div>
${corpo}
<div class="rodape">Gerado em ${esc(cab.geradoEm)} por ${esc(cab.geradoPor)}</div>
</body></html>`;
}

function corSaldo(centavos: number): string {
  return centavos < 0 ? 'vermelho' : 'verde';
}

function tabelaResumo(r: ResumoMes): string {
  return `<table class="resumo">
<tr><td>Saldo anterior</td><td class="${corSaldo(r.saldoAnterior)}">${formatarReais(r.saldoAnterior)}</td></tr>
<tr class="sub"><td>Dízimos</td><td>${formatarReais(r.dizimos)}</td></tr>
<tr class="sub"><td>Ofertas</td><td>${formatarReais(r.ofertas)}</td></tr>
<tr><td class="verde">Total de entradas</td><td class="verde">${formatarReais(r.entradas)}</td></tr>
<tr><td class="vermelho">Total de saídas</td><td class="vermelho">${formatarReais(r.saidas)}</td></tr>
<tr><td>Resultado do mês</td><td class="${corSaldo(r.resultado)}">${formatarComSinal(r.resultado)}</td></tr>
<tr class="caixa ${r.saldoCaixa < 0 ? 'fundo-vermelho' : 'fundo-verde'}"><td><b>Saldo em caixa</b></td><td class="${corSaldo(r.saldoCaixa)}">${formatarReais(r.saldoCaixa)}</td></tr>
</table>`;
}

/** Relatório do mês: resumo com o caixa + lista de lançamentos. */
export function htmlRelatorio(itens: Lancamento[], resumo: ResumoMes, cab: Cabecalho): string {
  const linhas = ordenarAntigos(itens).map((l) => `<tr>
<td>${dataBR(l.dataReferencia)}</td><td>${esc(l.tipo)}</td><td>${esc(l.categoria)}</td><td>${esc(l.descricao)}</td>
<td>${esc(l.responsavel)}</td><td class="num ${l.tipo === 'Entrada' ? 'verde' : 'vermelho'}">${l.tipo === 'Entrada' ? '+ ' : '- '}${formatarReais(l.valorCentavos)}</td></tr>`).join('\n');
  const corpo = `${tabelaResumo(resumo)}
<h2>Lançamentos (${resumo.quantidade})</h2>
<table class="lista"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição / Nome</th><th>Responsável</th><th style="text-align:right">Valor</th></tr></thead>
<tbody>${linhas || '<tr><td colspan="6">Nenhum lançamento neste mês.</td></tr>'}</tbody></table>`;
  return pagina('Relatório financeiro - ' + nomeMes(resumo.mes), cab, corpo);
}

export interface GraficosDashboard {
  linha: Grafico;
  barras: Grafico;
  despesas: Grafico | null;
  comparativo: Grafico;
}

/** Dashboard do mês em uma página: números principais, gráficos e comparação com os meses anteriores. */
export function htmlDashboard(resumo: ResumoMes, comparativo: ResumoMes[], g: GraficosDashboard, cab: Cabecalho): string {
  const quadro = (rotulo: string, valor: string, classe = '') => `<div class="quadro"><span>${rotulo}</span><strong class="${classe}">${valor}</strong></div>`;
  const linhasComparativo = comparativo.map((m) => `<tr><td>${esc(nomeMesCurto(m.mes))}</td>
<td class="num verde">${formatarReais(m.entradas)}</td><td class="num vermelho">${formatarReais(m.saidas)}</td>
<td class="num ${corSaldo(m.resultado)}">${formatarComSinal(m.resultado)}</td><td class="num ${corSaldo(m.saldoCaixa)}">${formatarReais(m.saldoCaixa)}</td></tr>`).join('\n');
  const corpo = `<div class="quadros">
${quadro('Saldo anterior', formatarReais(resumo.saldoAnterior), corSaldo(resumo.saldoAnterior))}
${quadro('Entradas', formatarReais(resumo.entradas), 'verde')}
${quadro('Saídas', formatarReais(resumo.saidas), 'vermelho')}
${quadro('Saldo em caixa', formatarReais(resumo.saldoCaixa), corSaldo(resumo.saldoCaixa))}
</div>
<div class="bloco"><h2>Caixa ao longo do mês</h2><div class="grafico" style="width:78%;margin:0 auto">${g.linha.xml}</div></div>
<div class="duas bloco">
<div><h2>De onde veio e para onde foi</h2><div class="grafico">${g.barras.xml}</div></div>
<div><h2>Maiores despesas</h2><div class="grafico">${g.despesas ? g.despesas.xml : '<p>Nenhuma despesa neste mês.</p>'}</div></div>
</div>
<div class="bloco"><h2>Últimos meses</h2>
<div class="grafico" style="width:62%;margin:0 auto 8pt">${g.comparativo.xml}</div>
<table class="lista"><thead><tr><th>Mês</th><th style="text-align:right">Entradas</th><th style="text-align:right">Saídas</th><th style="text-align:right">Resultado</th><th style="text-align:right">Saldo em caixa</th></tr></thead>
<tbody>${linhasComparativo}</tbody></table></div>`;
  return pagina('Dashboard financeiro - ' + nomeMes(resumo.mes), cab, corpo);
}

export { dataHoraBR };
