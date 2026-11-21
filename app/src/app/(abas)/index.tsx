import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MESES, dataBR, hojeISO, mesAtual, primeiroNome, rotuloDia } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { PALETA_CLARA, PALETA_ESCURA, graficoLinhaMini } from '@/core/graficos';
import { serieDiaria } from '@/core/totais';
import { useBanco, useCaixa, useSessao } from '@/dados/hooks';
import { Cartao, Texto, Vazio } from '@/ui/base';
import { Degrade } from '@/ui/Degrade';
import { Desenho } from '@/ui/Graficos';
import { GrupoDeLancamentos, ItemLancamento, legendaPadrao } from '@/ui/ItemLancamento';
import { definirMes } from '@/ui/mes';
import { ESPACO_DO_MENU } from '@/ui/MenuFlutuante';
import { Cabecalho, Corpo } from '@/ui/Tela';
import { ESPACO, FONTE, RAIO, useCores } from '@/ui/tema';
import { toque } from '@/ui/toque';

function Link({ titulo, onPress, testID }: { titulo: string; onPress: () => void; testID?: string }) {
  const c = useCores();
  return (
    <Pressable testID={testID} accessibilityRole="link" onPress={() => { toque.leve(); onPress(); }} hitSlop={10}>
      <Text style={{ fontFamily: FONTE.forte, fontSize: 13.5, color: c.laranjaEscuro }}>{titulo}</Text>
    </Pressable>
  );
}

/** Tela inicial: saldo em caixa em destaque, o caixa do mês e os últimos lançamentos. */
export default function Inicio() {
  const c = useCores();
  const caixa = useCaixa();
  const lancamentos = useBanco((e) => e.lancamentos);
  const usuario = useBanco((e) => e.usuario);
  const conta = useSessao((e) => e.conta);
  const hoje = hojeISO();
  const mes = mesAtual();
  const nomeDoMes = MESES[Number(mes.slice(5, 7)) - 1].toLowerCase();
  const resumo = caixa.resumoDoMes(mes);
  const doMes = caixa.porMes.get(mes) ?? [];

  const ultimos = useMemo(
    () => Object.values(lancamentos).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0)).slice(0, 5),
    [lancamentos],
  );
  const grafico = useMemo(
    () => graficoLinhaMini(serieDiaria(doMes, mes, resumo.saldoAnterior, hoje), c.escuro ? PALETA_ESCURA : PALETA_CLARA),
    [doMes, mes, resumo.saldoAnterior, hoje, c.escuro],
  );

  const nome = primeiroNome(usuario?.nome || conta?.nome || '');
  const negativo = caixa.saldoAtual < 0;

  /** "hoje", "ontem" ou "08/11/2026" */
  function quando(data: string): string {
    const r = rotuloDia(data, hoje);
    return r === 'Hoje' || r === 'Ontem' ? r.toLowerCase() : dataBR(data);
  }

  function abrirMes(rota: '/dashboard' | '/lancamentos') {
    definirMes(mes);
    router.navigate(rota);
  }

  return (
    <View style={{ flex: 1 }} testID="tela-inicio">
      <Cabecalho saudacao={nome || undefined} />
      <Corpo puxarParaAtualizar espacoInferior={ESPACO_DO_MENU}>
        <Degrade
          testID="cartao-caixa"
          cores={negativo ? ['#D23A3A', '#A11D24'] : ['#F28A1E', '#E06E00', '#A94C00']}
          style={{ borderRadius: RAIO.g + 4, padding: ESPACO.g + 4, gap: ESPACO.m, boxShadow: negativo ? '0 10px 22px rgba(161,29,36,0.3)' : '0 10px 22px rgba(196,92,0,0.32)' }}>
          <View>
            <Text style={{ fontFamily: FONTE.media, fontSize: 14, color: '#FFFFFF', opacity: 0.95 }}>Saldo em caixa</Text>
            <Text testID="inicio-caixa" numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FONTE.preta, fontSize: 36, color: '#FFFFFF', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>
              {formatarReais(caixa.saldoAtual)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
            {([['↑ Entradas em ' + nomeDoMes, resumo.entradas, 'inicio-entradas'], ['↓ Saídas em ' + nomeDoMes, resumo.saidas, 'inicio-saidas']] as const).map(([rotulo, valor, id]) => (
              <View key={id} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 11 }}>
                <Text numberOfLines={2} style={{ fontFamily: FONTE.media, fontSize: 12, color: '#FFFFFF' }}>{rotulo}</Text>
                <Text testID={id} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: FONTE.preta, fontSize: 16, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{formatarReais(valor)}</Text>
              </View>
            ))}
          </View>
        </Degrade>

        <Cartao style={{ gap: ESPACO.p }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Texto tipo="subtitulo" style={{ fontSize: 17 }}>Caixa em {nomeDoMes}</Texto>
            <Link testID="ver-dashboard" titulo="ver dashboard" onPress={() => abrirMes('/dashboard')} />
          </View>
          {doMes.length ? (
            <Desenho testID="inicio-grafico" grafico={grafico} descricao={'Caixa ao longo de ' + nomeDoMes + ', terminando em ' + formatarReais(resumo.saldoCaixa)} />
          ) : (
            <Texto suave>Ainda não há lançamentos em {nomeDoMes}.</Texto>
          )}
        </Cartao>

        <View style={{ gap: ESPACO.p }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
            <Texto tipo="subtitulo" style={{ fontSize: 17 }}>Últimos lançamentos</Texto>
            <Link testID="ver-todos" titulo="ver todos" onPress={() => abrirMes('/lancamentos')} />
          </View>
          {ultimos.length ? (
            <GrupoDeLancamentos testID="ultimos">
              {ultimos.map((l) => (
                <ItemLancamento
                  key={l.id}
                  l={l}
                  emGrupo
                  legenda={quando(l.dataReferencia) + ' · ' + legendaPadrao(l)}
                  aoAbrir={() => router.push({ pathname: '/lancamento/[id]', params: { id: l.id } })}
                />
              ))}
            </GrupoDeLancamentos>
          ) : (
            <Cartao><Vazio icone="add-circle-outline" titulo="Nenhum lançamento ainda" texto="Toque no botão + embaixo para lançar." /></Cartao>
          )}
        </View>
      </Corpo>
    </View>
  );
}
