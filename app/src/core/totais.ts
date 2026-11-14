import { diasNoMes, mesDe, somarMeses } from './datas';
import { normalizar } from './texto';
import { Lancamento, Membro } from './tipos';

export interface Totais {
  dizimos: number;
  ofertas: number;
  entradas: number;
  saidas: number;
  /** entradas - saídas do período */
  resultado: number;
  quantidade: number;
}

/** Resumo de um mês, já com o caixa: saldo anterior + entradas - saídas = saldo em caixa. */
export interface ResumoMes extends Totais {
  mes: string;
  saldoAnterior: number;
  saldoCaixa: number;
}

export function totalizar(lancamentos: Lancamento[]): Totais {
  const t: Totais = { dizimos: 0, ofertas: 0, entradas: 0, saidas: 0, resultado: 0, quantidade: 0 };
  for (const l of lancamentos) {
    if (l.excluidoEm) continue;
    t.quantidade++;
    if (l.tipo === 'Entrada') {
      t.entradas += l.valorCentavos;
      if (l.categoria === 'Dízimo') t.dizimos += l.valorCentavos;
      else if (l.categoria === 'Oferta') t.ofertas += l.valorCentavos;
    } else {
      t.saidas += l.valorCentavos;
    }
  }
  t.resultado = t.entradas - t.saidas;
  return t;
}

/** Agrupa os lançamentos válidos por mês ("AAAA-MM"). */
export function agruparPorMes(lancamentos: Iterable<Lancamento>): Map<string, Lancamento[]> {
  const mapa = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if (l.excluidoEm) continue;
    const mes = mesDe(l.dataReferencia);
    const lista = mapa.get(mes);
    if (lista) lista.push(l);
    else mapa.set(mes, [l]);
  }
  return mapa;
}

/**
 * Caixa acumulado: cada mês começa com o saldo em que o anterior terminou.
 * Devolve uma função que responde o resumo de QUALQUER mês (mesmo sem lançamentos).
 */
export function calcularCaixa(porMes: Map<string, Lancamento[]>, saldoAberturaCentavos: number) {
  const meses = Array.from(porMes.keys()).sort();
  const resumos = new Map<string, ResumoMes>();
  let saldo = saldoAberturaCentavos;
  for (const mes of meses) {
    const t = totalizar(porMes.get(mes) ?? []);
    const resumo: ResumoMes = { ...t, mes, saldoAnterior: saldo, saldoCaixa: saldo + t.resultado };
    resumos.set(mes, resumo);
    saldo = resumo.saldoCaixa;
  }

  function resumoDoMes(mes: string): ResumoMes {
    const existente = resumos.get(mes);
    if (existente) return existente;
    // Mês sem lançamentos: carrega o saldo do último mês anterior que teve movimento.
    let anterior = saldoAberturaCentavos;
    for (const m of meses) {
      if (m < mes) anterior = resumos.get(m)!.saldoCaixa;
      else break;
    }
    return {
      mes, dizimos: 0, ofertas: 0, entradas: 0, saidas: 0, resultado: 0, quantidade: 0,
      saldoAnterior: anterior, saldoCaixa: anterior,
    };
  }

  return {
    resumoDoMes,
    /** Saldo em caixa hoje (depois de todos os lançamentos). */
    saldoAtual: saldo,
    primeiroMes: meses[0] ?? null,
    ultimoMes: meses[meses.length - 1] ?? null,
    /** Os `n` meses terminando em `mesFinal` (do mais antigo para o mais novo). */
    comparativo(mesFinal: string, n: number): ResumoMes[] {
      const lista: ResumoMes[] = [];
      for (let i = n - 1; i >= 0; i--) lista.push(resumoDoMes(somarMeses(mesFinal, -i)));
      return lista;
    },
  };
}

/** Mais recentes primeiro (data de referência; no empate, o lançado por último). */
export function ordenarRecentes(lancamentos: Lancamento[]): Lancamento[] {
  return lancamentos.slice().sort((a, b) => {
    if (a.dataReferencia !== b.dataReferencia) return a.dataReferencia < b.dataReferencia ? 1 : -1;
    if (a.criadoEm !== b.criadoEm) return a.criadoEm < b.criadoEm ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/** Mais antigos primeiro (para relatórios). */
export function ordenarAntigos(lancamentos: Lancamento[]): Lancamento[] {
  return ordenarRecentes(lancamentos).reverse();
}

export interface Filtro {
  busca?: string;
  tipo?: 'Entrada' | 'Saída' | '';
  categoria?: string;
  responsavel?: string;
}

export function filtrar(lancamentos: Lancamento[], filtro: Filtro): Lancamento[] {
  const termo = normalizar(filtro.busca);
  const valorBuscado = termo.replace(/[^\d,]/g, '');
  return lancamentos.filter((l) => {
    if (filtro.tipo && l.tipo !== filtro.tipo) return false;
    if (filtro.categoria && l.categoria !== filtro.categoria) return false;
    if (filtro.responsavel && normalizar(l.responsavel) !== normalizar(filtro.responsavel)) return false;
    if (!termo) return true;
    const texto = normalizar([l.descricao, l.categoria, l.tipo, l.responsavel].join(' '));
    if (texto.includes(termo)) return true;
    // busca por valor: "50", "50,00", "1.234,56"
    if (valorBuscado) {
      const reais = (l.valorCentavos / 100).toFixed(2).replace('.', ',');
      if (reais.startsWith(valorBuscado) || reais.replace(',00', '') === valorBuscado) return true;
    }
    return false;
  });
}

export interface Dia {
  dia: number;
  entrou: number;
  saiu: number;
  /** Saldo em caixa no fim do dia (já contando o saldo anterior do mês). */
  saldo: number;
  temLancamento: boolean;
}

/** Evolução do caixa dia a dia. No mês atual vai só até hoje. */
export function serieDiaria(doMes: Lancamento[], mes: string, saldoAnterior: number, hoje: string): Dia[] {
  let ultimoDia = mesDe(hoje) === mes ? Number(hoje.slice(8, 10)) : diasNoMes(mes);
  for (const l of doMes) {
    const d = Number(l.dataReferencia.slice(8, 10));
    if (d > ultimoDia) ultimoDia = d;
  }
  const dias: Dia[] = [];
  for (let d = 1; d <= ultimoDia; d++) dias.push({ dia: d, entrou: 0, saiu: 0, saldo: 0, temLancamento: false });
  for (const l of doMes) {
    if (l.excluidoEm) continue;
    const dia = dias[Number(l.dataReferencia.slice(8, 10)) - 1];
    if (!dia) continue;
    dia.temLancamento = true;
    if (l.tipo === 'Entrada') dia.entrou += l.valorCentavos;
    else dia.saiu += l.valorCentavos;
  }
  let saldo = saldoAnterior;
  for (const d of dias) {
    saldo += d.entrou - d.saiu;
    d.saldo = saldo;
  }
  return dias;
}

export interface Fatia {
  rotulo: string;
  centavos: number;
}

/** As maiores despesas do mês, agrupadas pela descrição; as demais viram "Outras (n)". */
export function despesasPrincipais(doMes: Lancamento[], maximo = 4): Fatia[] {
  const grupos = new Map<string, Fatia>();
  for (const l of doMes) {
    if (l.excluidoEm || l.tipo !== 'Saída') continue;
    const nome = l.descricao || 'Sem descrição';
    const chave = normalizar(nome);
    const g = grupos.get(chave);
    if (g) g.centavos += l.valorCentavos;
    else grupos.set(chave, { rotulo: nome, centavos: l.valorCentavos });
  }
  const lista = Array.from(grupos.values()).sort((a, b) => b.centavos - a.centavos || (a.rotulo < b.rotulo ? -1 : 1));
  if (lista.length <= maximo + 1) return lista;
  const outras = lista.slice(maximo);
  return lista.slice(0, maximo).concat([
    { rotulo: 'Outras (' + outras.length + ')', centavos: outras.reduce((s, o) => s + o.centavos, 0) },
  ]);
}

/** Textos mais usados primeiro (para as sugestões do formulário). */
export function maisUsados(textos: string[]): string[] {
  const contagem = new Map<string, { texto: string; n: number }>();
  for (const t of textos) {
    const limpo = t.trim();
    if (!limpo) continue;
    const chave = normalizar(limpo);
    const atual = contagem.get(chave);
    if (atual) atual.n++;
    else contagem.set(chave, { texto: limpo, n: 1 });
  }
  return Array.from(contagem.values())
    .sort((a, b) => b.n - a.n || (normalizar(a.texto) < normalizar(b.texto) ? -1 : 1))
    .map((c) => c.texto);
}

export interface HistoricoMembro {
  itens: Lancamento[];
  totalCentavos: number;
  dizimosCentavos: number;
  ofertasCentavos: number;
  quantidade: number;
  ultimaData: string | null;
}

/** Contribuições de um membro (ligadas pelo cadastro ou, nas antigas, pelo mesmo nome). */
export function historicoDoMembro(lancamentos: Iterable<Lancamento>, membro: Membro): HistoricoMembro {
  const nome = normalizar(membro.nome);
  const itens: Lancamento[] = [];
  for (const l of lancamentos) {
    if (l.excluidoEm || l.tipo !== 'Entrada') continue;
    if (l.membroId === membro.id || (!l.membroId && nome && normalizar(l.descricao) === nome)) itens.push(l);
  }
  const ordenados = ordenarRecentes(itens);
  const t = totalizar(ordenados);
  return {
    itens: ordenados,
    totalCentavos: t.entradas,
    dizimosCentavos: t.dizimos,
    ofertasCentavos: t.ofertas,
    quantidade: t.quantidade,
    ultimaData: ordenados[0]?.dataReferencia ?? null,
  };
}
