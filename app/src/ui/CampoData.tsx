import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { MESES, dataBR, dataPorExtenso, diasNoMes, hojeISO, mesDe, somarMeses } from '@/core/datas';

import { Botao, Texto } from './base';
import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Campo de data: mostra a data por extenso e abre um calendário ao tocar. */
export function CampoData({
  valor, onMudar, minimo, maximo, erro,
}: { valor: string; onMudar: (iso: string) => void; minimo: string; maximo: string; erro?: boolean }) {
  const c = useCores();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(mesDe(valor || hojeISO()));
  const hoje = hojeISO();

  const primeiroDiaSemana = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).getDay();
  const celulas: (number | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes(mes); d++) celulas.push(d);
  while (celulas.length % 7) celulas.push(null);

  return (
    <View>
      <Pressable
        testID="campo-data"
        accessibilityRole="button"
        accessibilityLabel={'Data: ' + dataPorExtenso(valor) + '. Toque para mudar.'}
        onPress={() => { toque.leve(); setMes(mesDe(valor || hoje)); setAberto(true); }}
        style={({ pressed }) => ({
          minHeight: 56, borderRadius: RAIO.m, borderWidth: 2, borderColor: erro ? c.saida : c.borda, backgroundColor: c.cartao,
          flexDirection: 'row', alignItems: 'center', gap: ESPACO.m, paddingHorizontal: ESPACO.g, opacity: pressed ? 0.7 : 1,
        })}>
        <Ionicons name="calendar-outline" size={22} color={c.textoSuave} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTE.forte, fontSize: 17, color: c.texto }}>{dataBR(valor)}{valor === hoje ? ' · hoje' : ''}</Text>
          <Text style={{ fontFamily: FONTE.normal, fontSize: 13, color: c.textoSuave }}>{dataPorExtenso(valor)}</Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={c.textoSuave} />
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: c.fundoModal, alignItems: 'center', justifyContent: 'center', padding: ESPACO.g }} onPress={() => setAberto(false)}>
          <Pressable testID="calendario" onPress={() => {}} style={{ width: '100%', maxWidth: 400, backgroundColor: c.cartao, borderRadius: RAIO.g, padding: ESPACO.g, gap: ESPACO.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable testID="cal-anterior" accessibilityRole="button" accessibilityLabel="Mês anterior" disabled={mes <= mesDe(minimo)} hitSlop={8}
                onPress={() => setMes(somarMeses(mes, -1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: mes <= mesDe(minimo) ? 0.3 : 1 }}>
                <Ionicons name="chevron-back" size={24} color={c.texto} />
              </Pressable>
              <Texto tipo="subtitulo">{MESES[Number(mes.slice(5, 7)) - 1]} de {mes.slice(0, 4)}</Texto>
              <Pressable testID="cal-seguinte" accessibilityRole="button" accessibilityLabel="Próximo mês" disabled={mes >= mesDe(maximo)} hitSlop={8}
                onPress={() => setMes(somarMeses(mes, 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: mes >= mesDe(maximo) ? 0.3 : 1 }}>
                <Ionicons name="chevron-forward" size={24} color={c.texto} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {SEMANA.map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: FONTE.media, fontSize: 13, color: c.textoSuave }}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {celulas.map((dia, i) => {
                if (dia === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
                const iso = mes + '-' + ('0' + dia).slice(-2);
                const fora = iso < minimo || iso > maximo;
                const escolhido = iso === valor;
                return (
                  <Pressable
                    key={i}
                    testID={'dia-' + iso}
                    accessibilityRole="button"
                    accessibilityLabel={dataPorExtenso(iso)}
                    accessibilityState={{ selected: escolhido, disabled: fora }}
                    disabled={fora}
                    onPress={() => { toque.leve(); onMudar(iso); setAberto(false); }}
                    style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: escolhido ? c.laranja : 'transparent',
                      borderWidth: iso === hoje && !escolhido ? 2 : 0, borderColor: c.laranja,
                    }}>
                      <Text style={{ fontFamily: escolhido ? FONTE.forte : FONTE.media, fontSize: 16, color: escolhido ? c.sobreLaranja : c.texto, opacity: fora ? 0.3 : 1 }}>{dia}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: ESPACO.m }}>
              <Botao titulo="Hoje" tipo="suave" pequeno style={{ flex: 1 }} onPress={() => { onMudar(hoje); setAberto(false); }} />
              <Botao titulo="Fechar" tipo="secundario" pequeno style={{ flex: 1 }} onPress={() => setAberto(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
