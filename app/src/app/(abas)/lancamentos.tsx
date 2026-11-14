import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { nomeMes } from '@/core/datas';
import { formatarComSinal, formatarReais } from '@/core/dinheiro';
import { gerarExcel, htmlRelatorio, nomeArquivo } from '@/core/relatorios';
import { filtrar, ordenarRecentes } from '@/core/totais';
import { NOME_APP } from '@/config';
import { useCaixa, usePodeEscrever } from '@/dados/hooks';
import { excluirComConfirmacao, tentar } from '@/ui/acoes';
import { Botao, CampoTexto, Cartao, LinhaValor, Texto, Vazio } from '@/ui/base';
import { cabecalhoRelatorio, compartilharExcel, compartilharPdf } from '@/ui/exportar';
import { ItemLancamento } from '@/ui/ItemLancamento';
import { useMes } from '@/ui/mes';
import { SeletorMes } from '@/ui/SeletorMes';
import { Cabecalho, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, useCores } from '@/ui/tema';
import { toque } from '@/ui/toque';

type FiltroTipo = '' | 'Entrada' | 'Saída';

/** Tela 2 — Lançamentos do mês */
export default function Lancamentos() {
  const c = useCores();
  const mes = useMes();
  const caixa = useCaixa();
  const podeEscrever = usePodeEscrever();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<FiltroTipo>('');
  const [exportando, setExportando] = useState<'' | 'excel' | 'pdf'>('');

  const doMes = useMemo(() => ordenarRecentes(caixa.porMes.get(mes) ?? []), [caixa, mes]);
  const visiveis = useMemo(() => filtrar(doMes, { busca, tipo }), [doMes, busca, tipo]);
  const resumo = caixa.resumoDoMes(mes);
  const filtrando = !!busca.trim() || !!tipo;

  async function exportar(formato: 'excel' | 'pdf') {
    if (exportando) return;
    setExportando(formato);
    await tentar(async () => {
      if (!doMes.length) throw new Error('Não há lançamentos em ' + nomeMes(mes) + ' para exportar.');
      const cab = cabecalhoRelatorio();
      if (formato === 'excel') await compartilharExcel(gerarExcel(doMes, resumo, cab), nomeArquivo(NOME_APP, 'lancamentos', mes, 'xlsx'));
      else await compartilharPdf(htmlRelatorio(doMes, resumo, cab), nomeArquivo(NOME_APP, 'relatorio', mes, 'pdf'));
    }, 'Não foi possível gerar o arquivo.');
    setExportando('');
  }

  return (
    <View style={{ flex: 1 }} testID="tela-lancamentos">
      <Cabecalho />
      <Corpo puxarParaAtualizar>
        <Texto tipo="titulo">Lançamentos</Texto>
        <SeletorMes />

        <View style={{ gap: ESPACO.p }}>
          <View>
            <CampoTexto
              testID="busca"
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar nome, despesa ou valor"
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Buscar nos lançamentos do mês"
              style={{ paddingLeft: 46, minHeight: 50 }}
            />
            <Ionicons name="search" size={20} color={c.textoSuave} style={{ position: 'absolute', left: 16, top: 15 }} />
            {busca ? (
              <Pressable testID="busca-limpar" accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setBusca('')} hitSlop={8} style={{ position: 'absolute', right: 8, top: 7, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close-circle" size={20} color={c.textoSuave} />
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: ESPACO.p }}>
            {([['', 'Todos'], ['Entrada', 'Entradas'], ['Saída', 'Saídas']] as [FiltroTipo, string][]).map(([valor, rotulo]) => {
              const ativo = tipo === valor;
              return (
                <Pressable
                  key={rotulo}
                  testID={'filtro-' + rotulo.toLowerCase()}
                  accessibilityRole="button"
                  accessibilityLabel={'Mostrar: ' + rotulo}
                  accessibilityState={{ selected: ativo }}
                  onPress={() => { toque.leve(); setTipo(valor); }}
                  style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? c.rocha : c.cartao, borderWidth: 1, borderColor: ativo ? c.rocha : c.borda }}>
                  <Text style={{ fontFamily: FONTE.forte, fontSize: 14, color: ativo ? c.cartao : c.texto }}>{rotulo}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: ESPACO.p + 2 }} testID="lista">
          {filtrando && doMes.length ? (
            <Texto tipo="pequeno" suave testID="contagem-filtro">Mostrando {visiveis.length} de {doMes.length} lançamentos.</Texto>
          ) : null}
          {visiveis.map((l) => (
            <ItemLancamento
              key={l.id}
              l={l}
              aoAbrir={() => router.push({ pathname: '/lancamento/[id]', params: { id: l.id } })}
              aoExcluir={podeEscrever ? () => void excluirComConfirmacao(l) : undefined}
            />
          ))}
          {!doMes.length ? (
            <Vazio icone="document-text-outline" titulo={'Nenhum lançamento em ' + nomeMes(mes)} texto="Os lançamentos deste mês aparecem aqui." />
          ) : !visiveis.length ? (
            <Vazio icone="search-outline" titulo="Nada encontrado" texto="Tente outra palavra ou limpe os filtros." />
          ) : null}
        </View>

        <Cartao testID="resumo">
          <Texto tipo="subtitulo" style={{ marginBottom: ESPACO.p }}>Resumo de {nomeMes(mes)}</Texto>
          <LinhaValor testID="r-anterior" rotulo="Saldo anterior" valor={formatarReais(resumo.saldoAnterior)} cor={resumo.saldoAnterior < 0 ? c.saida : undefined} />
          <LinhaValor testID="r-dizimos" rotulo="Dízimos" valor={formatarReais(resumo.dizimos)} recuo />
          <LinhaValor testID="r-ofertas" rotulo="Ofertas" valor={formatarReais(resumo.ofertas)} recuo />
          <LinhaValor testID="r-entradas" rotulo="Total de entradas" valor={formatarReais(resumo.entradas)} cor={c.entrada} forte />
          <LinhaValor testID="r-saidas" rotulo="Total de saídas" valor={formatarReais(resumo.saidas)} cor={c.saida} forte />
          <LinhaValor testID="r-resultado" rotulo="Resultado do mês" valor={formatarComSinal(resumo.resultado)} cor={resumo.resultado < 0 ? c.saida : c.entrada} />
          <View style={{ marginTop: ESPACO.p, borderRadius: 12, padding: ESPACO.m, backgroundColor: resumo.saldoCaixa < 0 ? c.saidaSuave : c.entradaSuave, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontFamily: FONTE.preta, fontSize: 17, color: resumo.saldoCaixa < 0 ? c.saida : c.entrada }}>Saldo em caixa</Text>
              <Text style={{ fontFamily: FONTE.normal, fontSize: 12, color: c.textoSuave }}>saldo anterior + entradas − saídas</Text>
            </View>
            <Text testID="r-caixa" style={{ fontFamily: FONTE.preta, fontSize: 19, color: resumo.saldoCaixa < 0 ? c.saida : c.entrada, fontVariant: ['tabular-nums'] }}>{formatarReais(resumo.saldoCaixa)}</Text>
          </View>
        </Cartao>

        <View>
          <Texto tipo="rotulo" suave style={{ marginBottom: ESPACO.p }}>Exportar este mês</Texto>
          <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
            <Botao testID="exportar-excel" titulo="Excel" tipo="secundario" icone="grid-outline" carregando={exportando === 'excel'} onPress={() => void exportar('excel')} style={{ flex: 1 }} />
            <Botao testID="exportar-pdf" titulo="PDF" tipo="secundario" icone="document-text-outline" carregando={exportando === 'pdf'} onPress={() => void exportar('pdf')} style={{ flex: 1 }} />
          </View>
        </View>
      </Corpo>
    </View>
  );
}
