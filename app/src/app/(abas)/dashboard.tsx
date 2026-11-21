import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { hojeISO, nomeMes, nomeMesCurto } from '@/core/datas';
import { formatarComSinal, formatarReais } from '@/core/dinheiro';
import { PALETA_CLARA, PALETA_ESCURA, Paleta, graficoBarras, graficoComparativo, graficoLinha, graficoRosca } from '@/core/graficos';
import { htmlContabilidade, htmlDashboard, nomeArquivo } from '@/core/relatorios';
import { Lancamento } from '@/core/tipos';
import { ResumoMes, demonstrativoContabil, despesasPrincipais, serieDiaria } from '@/core/totais';
import { NOME_APP } from '@/config';
import { useCaixa } from '@/dados/hooks';
import { tentar } from '@/ui/acoes';
import { Botao, Cartao, Texto, Vazio } from '@/ui/base';
import { cabecalhoRelatorio, compartilharPdf } from '@/ui/exportar';
import { Desenho, LinhaComToque } from '@/ui/Graficos';
import { useMes } from '@/ui/mes';
import { SeletorMes } from '@/ui/SeletorMes';
import { ESPACO_DO_MENU } from '@/ui/MenuFlutuante';
import { Cabecalho, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, RAIO, useCores } from '@/ui/tema';

const MESES_NO_COMPARATIVO = 6;

function montarGraficos(doMes: Lancamento[], resumo: ResumoMes, comparativo: ResumoMes[], p: Paleta) {
  const dias = serieDiaria(doMes, resumo.mes, resumo.saldoAnterior, hojeISO());
  const despesas = despesasPrincipais(doMes).map((d) => ({ ...d, cor: p.saida }));
  return {
    dias,
    linha: graficoLinha(dias, p),
    rosca: graficoRosca([
      { rotulo: 'Dízimos', centavos: resumo.dizimos, cor: p.entrada },
      { rotulo: 'Ofertas', centavos: resumo.ofertas, cor: p.entradaClara },
      { rotulo: 'Saídas', centavos: resumo.saidas, cor: p.saida },
    ], { titulo: 'resultado', valor: formatarComSinal(resumo.resultado).replace('R$ ', ''), cor: resumo.resultado < 0 ? p.saida : p.entrada }, p),
    despesas: despesas.length ? graficoBarras(despesas, p) : null,
    comparativo: graficoComparativo(comparativo, p, resumo.mes),
  };
}

function Quadro({ rotulo, valor, cor, fundo, testID }: { rotulo: string; valor: string; cor?: string; fundo?: string; testID?: string }) {
  const c = useCores();
  return (
    <View style={{ flex: 1, minWidth: '46%', backgroundColor: fundo ?? c.cartao, borderRadius: RAIO.m, padding: ESPACO.m, borderWidth: c.escuro ? 1 : 0, borderColor: c.borda, boxShadow: c.escuro ? undefined : '0 1px 3px rgba(40,28,24,0.08)' }}>
      <Text style={{ fontFamily: FONTE.media, fontSize: 13, color: c.textoSuave }}>{rotulo}</Text>
      <Text testID={testID} style={{ fontFamily: FONTE.preta, fontSize: 19, color: cor ?? c.texto, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </View>
  );
}

/** Tela 3 — Dashboard do mês */
export default function Dashboard() {
  const c = useCores();
  const mes = useMes();
  const caixa = useCaixa();
  const [exportando, setExportando] = useState<'' | 'dashboard' | 'contabilidade'>('');

  const doMes = caixa.porMes.get(mes) ?? [];
  const resumo = caixa.resumoDoMes(mes);
  const comparativo = useMemo(() => caixa.comparativo(mes, MESES_NO_COMPARATIVO), [caixa, mes]);
  const g = useMemo(() => montarGraficos(doMes, resumo, comparativo, c.escuro ? PALETA_ESCURA : PALETA_CLARA), [doMes, resumo, comparativo, c.escuro]);
  const temHistorico = comparativo.some((m) => m.quantidade > 0);

  async function exportar(qual: 'dashboard' | 'contabilidade') {
    if (exportando) return;
    setExportando(qual);
    await tentar(async () => {
      if (!doMes.length) throw new Error('Não há lançamentos em ' + nomeMes(mes) + ' para exportar.');
      const p = PALETA_CLARA; // o PDF é sempre em fundo branco
      if (qual === 'dashboard') {
        const claro = montarGraficos(doMes, resumo, comparativo, p);
        await compartilharPdf(htmlDashboard(resumo, comparativo, claro, cabecalhoRelatorio()), nomeArquivo(NOME_APP, 'dashboard', mes, 'pdf'));
        return;
      }
      const d = demonstrativoContabil(doMes, mes);
      const saldoDoMes = d.entradas - d.totalDespesas;
      const rosca = graficoRosca([
        { rotulo: 'Dízimos', centavos: d.dizimos, cor: p.entrada },
        { rotulo: 'Ofertas', centavos: d.ofertas, cor: p.entradaClara },
        { rotulo: 'Saídas', centavos: d.totalDespesas, cor: p.saida },
      ], { titulo: 'saldo do mês', valor: formatarComSinal(saldoDoMes).replace('R$ ', ''), cor: saldoDoMes < 0 ? p.saida : p.entrada }, p);
      const despesas = d.despesas.length ? graficoBarras(d.despesas.map((x) => ({ ...x, cor: p.saida })), p) : null;
      // Sem o e-mail de quem gerou: o arquivo vai para fora da igreja.
      await compartilharPdf(htmlContabilidade(d, { rosca, despesas }, { ...cabecalhoRelatorio(), geradoPor: '' }), nomeArquivo(NOME_APP, 'contabilidade', mes, 'pdf'));
    }, 'Não foi possível gerar o PDF.');
    setExportando('');
  }

  const corCaixa = resumo.saldoCaixa < 0 ? c.saida : c.entrada;
  return (
    <View style={{ flex: 1 }} testID="tela-dashboard">
      <Cabecalho />
      <Corpo puxarParaAtualizar espacoInferior={ESPACO_DO_MENU}>
        <Texto tipo="titulo">Dashboard</Texto>
        <SeletorMes />

        <View style={{ borderRadius: RAIO.m, padding: ESPACO.g, backgroundColor: resumo.saldoCaixa < 0 ? c.saidaSuave : c.entradaSuave, gap: 2 }}>
          <Text style={{ fontFamily: FONTE.forte, fontSize: 14, color: c.textoSuave }}>Saldo em caixa no fim de {nomeMes(mes).toLowerCase()}</Text>
          <Text testID="k-caixa" style={{ fontFamily: FONTE.preta, fontSize: 32, color: corCaixa, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{formatarReais(resumo.saldoCaixa)}</Text>
          <Text testID="k-conta" style={{ fontFamily: FONTE.normal, fontSize: 13, color: c.textoSuave }}>
            {formatarReais(resumo.saldoAnterior)} do mês anterior {resumo.resultado < 0 ? '−' : '+'} {formatarReais(Math.abs(resumo.resultado))} deste mês
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.m }}>
          <Quadro testID="k-entradas" rotulo="Entradas" valor={formatarReais(resumo.entradas)} cor={c.entrada} />
          <Quadro testID="k-saidas" rotulo="Saídas" valor={formatarReais(resumo.saidas)} cor={c.saida} />
          <Quadro testID="k-resultado" rotulo="Resultado do mês" valor={formatarComSinal(resumo.resultado)} cor={resumo.resultado < 0 ? c.saida : c.entrada} />
          <Quadro testID="k-quantidade" rotulo="Lançamentos" valor={String(resumo.quantidade)} />
        </View>

        {doMes.length ? (
          <>
            <Cartao style={{ gap: ESPACO.p }}>
              <Texto tipo="subtitulo">Caixa ao longo do mês</Texto>
              <Texto tipo="pequeno" suave>Toque no gráfico para ver o saldo de cada dia.</Texto>
              <LinhaComToque testID="g-linha" grafico={g.linha} dias={g.dias} descricao={'Saldo em caixa ao longo de ' + nomeMes(mes) + ', terminando em ' + formatarReais(resumo.saldoCaixa)} />
            </Cartao>
            <Cartao style={{ gap: ESPACO.m }}>
              <Texto tipo="subtitulo">De onde veio e para onde foi</Texto>
              <Desenho testID="g-rosca" grafico={g.rosca} descricao={`Dízimos ${formatarReais(resumo.dizimos)}, ofertas ${formatarReais(resumo.ofertas)}, saídas ${formatarReais(resumo.saidas)}`} />
            </Cartao>
            <Cartao style={{ gap: ESPACO.m }}>
              <Texto tipo="subtitulo">Maiores despesas</Texto>
              {g.despesas ? <Desenho testID="g-despesas" grafico={g.despesas} descricao="Maiores despesas do mês" /> : <Texto suave>Nenhuma despesa neste mês.</Texto>}
            </Cartao>
          </>
        ) : (
          <Vazio icone="bar-chart-outline" titulo={'Nenhum lançamento em ' + nomeMes(mes)} texto="Os gráficos do mês aparecem quando houver lançamentos." />
        )}

        {temHistorico ? (
          <Cartao style={{ gap: ESPACO.m }} testID="comparativo">
            <Texto tipo="subtitulo">Últimos {MESES_NO_COMPARATIVO} meses</Texto>
            <Desenho testID="g-comparativo" grafico={g.comparativo} descricao="Entradas e saídas dos últimos meses" />
            <View>
              <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
                <Text style={{ flex: 1.1, fontFamily: FONTE.forte, fontSize: 12, color: c.textoSuave }}>Mês</Text>
                <Text style={{ flex: 2, fontFamily: FONTE.forte, fontSize: 12, color: c.textoSuave, textAlign: 'right' }}>Resultado</Text>
                <Text style={{ flex: 2, fontFamily: FONTE.forte, fontSize: 12, color: c.textoSuave, textAlign: 'right' }}>Caixa</Text>
              </View>
              {comparativo.map((m) => (
                <View key={m.mes} testID={'comp-' + m.mes} style={{ flexDirection: 'row', paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.borda }}>
                  <Text style={{ flex: 1.1, fontFamily: m.mes === mes ? FONTE.forte : FONTE.normal, fontSize: 14, color: c.texto }}>{nomeMesCurto(m.mes)}</Text>
                  <Text style={{ flex: 2, fontFamily: FONTE.media, fontSize: 14, textAlign: 'right', color: m.resultado < 0 ? c.saida : c.entrada, fontVariant: ['tabular-nums'] }}>{m.quantidade ? formatarComSinal(m.resultado) : '—'}</Text>
                  <Text style={{ flex: 2, fontFamily: FONTE.forte, fontSize: 14, textAlign: 'right', color: m.saldoCaixa < 0 ? c.saida : c.texto, fontVariant: ['tabular-nums'] }}>{formatarReais(m.saldoCaixa)}</Text>
                </View>
              ))}
            </View>
          </Cartao>
        ) : null}

        <Cartao style={{ gap: ESPACO.m }}>
          <Texto tipo="subtitulo" style={{ fontSize: 17 }}>Relatórios em PDF de {nomeMes(mes).toLowerCase()}</Texto>
          <Botao testID="exportar-dashboard" titulo="Dashboard em PDF" tipo="secundario" icone="document-text-outline" carregando={exportando === 'dashboard'} onPress={() => void exportar('dashboard')} />
          <Botao testID="exportar-contabilidade" titulo="PDF para a contabilidade" tipo="secundario" icone="briefcase-outline" carregando={exportando === 'contabilidade'} onPress={() => void exportar('contabilidade')} />
          <Texto tipo="pequeno" suave>
            O PDF para a contabilidade mostra só os lançamentos do mês: as entradas de um lado e, do outro, as despesas mais o saldo do mês, de modo que os dois totais fiquem iguais.
          </Texto>
        </Cartao>
      </Corpo>
    </View>
  );
}
