import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { MESES, mesAtual, nomeMes, somarMeses } from '@/core/datas';

import { Botao, Texto } from './base';
import { MES_MINIMO, definirMes, mesMaximo, useMes } from './mes';
import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

function Seta({ icone, rotulo, onPress, desativado, testID }: { icone: 'chevron-back' | 'chevron-forward'; rotulo: string; onPress: () => void; desativado: boolean; testID: string }) {
  const c = useCores();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desativado }}
      disabled={desativado}
      onPress={() => { toque.leve(); onPress(); }}
      style={({ pressed }) => ({
        width: 48, height: 52, borderRadius: RAIO.m, borderWidth: 2, borderColor: c.borda, backgroundColor: c.cartao,
        alignItems: 'center', justifyContent: 'center', opacity: desativado ? 0.35 : pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icone} size={22} color={c.texto} />
    </Pressable>
  );
}

/** "‹ Novembro de 2026 ›" — setas trocam o mês; tocar no nome abre a lista de meses. */
export function SeletorMes() {
  const c = useCores();
  const mes = useMes();
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(Number(mes.slice(0, 4)));
  const maximo = mesMaximo();
  const atual = mesAtual();

  return (
    <View style={{ flexDirection: 'row', gap: ESPACO.p, alignItems: 'center' }}>
      <Seta testID="mes-anterior" icone="chevron-back" rotulo="Mês anterior" desativado={mes <= MES_MINIMO} onPress={() => definirMes(somarMeses(mes, -1))} />
      <Pressable
        testID="mes-atual"
        accessibilityRole="button"
        accessibilityLabel={'Mês: ' + nomeMes(mes) + '. Toque para escolher outro.'}
        onPress={() => { toque.leve(); setAno(Number(mes.slice(0, 4))); setAberto(true); }}
        style={({ pressed }) => ({
          flex: 1, height: 52, borderRadius: RAIO.m, borderWidth: 2, borderColor: c.borda, backgroundColor: c.cartao,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.7 : 1,
        })}>
        <Text style={{ fontFamily: FONTE.forte, fontSize: 17, color: c.texto }}>{nomeMes(mes)}</Text>
        <Ionicons name="chevron-down" size={16} color={c.textoSuave} />
      </Pressable>
      <Seta testID="mes-seguinte" icone="chevron-forward" rotulo="Próximo mês" desativado={mes >= maximo} onPress={() => definirMes(somarMeses(mes, 1))} />

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: c.fundoModal, alignItems: 'center', justifyContent: 'center', padding: ESPACO.g }} onPress={() => setAberto(false)}>
          <Pressable testID="lista-meses" onPress={() => {}} style={{ width: '100%', maxWidth: 420, backgroundColor: c.cartao, borderRadius: RAIO.g, padding: ESPACO.g, gap: ESPACO.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Seta testID="ano-anterior" icone="chevron-back" rotulo="Ano anterior" desativado={ano <= Number(MES_MINIMO.slice(0, 4))} onPress={() => setAno(ano - 1)} />
              <Texto tipo="titulo">{ano}</Texto>
              <Seta testID="ano-seguinte" icone="chevron-forward" rotulo="Próximo ano" desativado={ano >= Number(maximo.slice(0, 4))} onPress={() => setAno(ano + 1)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.p }}>
              {MESES.map((nome, i) => {
                const chave = ano + '-' + ('0' + (i + 1)).slice(-2);
                const fora = chave < MES_MINIMO || chave > maximo;
                const escolhido = chave === mes;
                return (
                  <Pressable
                    key={chave}
                    testID={'mes-' + chave}
                    accessibilityRole="button"
                    accessibilityLabel={nome + ' de ' + ano}
                    accessibilityState={{ selected: escolhido, disabled: fora }}
                    disabled={fora}
                    onPress={() => { toque.leve(); definirMes(chave); setAberto(false); }}
                    style={{
                      width: '31.5%', height: 48, borderRadius: RAIO.p, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: escolhido ? c.laranja : c.cartaoSuave, opacity: fora ? 0.35 : 1,
                      borderWidth: chave === atual && !escolhido ? 2 : 0, borderColor: c.laranja,
                    }}>
                    <Text style={{ fontFamily: FONTE.forte, fontSize: 15, color: escolhido ? c.sobreLaranja : c.texto }}>{nome.slice(0, 3)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Botao titulo="Ir para o mês atual" tipo="suave" pequeno onPress={() => { definirMes(atual); setAberto(false); }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
