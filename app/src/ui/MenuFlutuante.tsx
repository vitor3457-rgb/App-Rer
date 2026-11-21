import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Degrade } from './Degrade';
import { FONTE, useCores } from './tema';
import { toque } from './toque';

type Icone = keyof typeof Ionicons.glyphMap;
const ABAS: { nome: string; titulo: string; cheio: Icone; vazado: Icone; testID: string }[] = [
  { nome: 'index', titulo: 'Início', cheio: 'home', vazado: 'home-outline', testID: 'aba-inicio' },
  { nome: 'lancamentos', titulo: 'Lançamentos', cheio: 'list', vazado: 'list-outline', testID: 'aba-lancamentos' },
  { nome: 'novo', titulo: 'Novo', cheio: 'add', vazado: 'add', testID: 'aba-novo' },
  { nome: 'dashboard', titulo: 'Dashboard', cheio: 'bar-chart', vazado: 'bar-chart-outline', testID: 'aba-dashboard' },
  { nome: 'mais', titulo: 'Mais', cheio: 'ellipsis-horizontal', vazado: 'ellipsis-horizontal', testID: 'aba-mais' },
];

const LARGURA_DO_MAIS = 68;
const MAIOR_NOME = Math.max(...ABAS.map((a) => a.titulo.length));

/**
 * Tamanho da letra dos nomes das abas: o normal é 11 (aumenta um pouco se o celular estiver com a letra
 * grande), mas nunca passa do que cabe na largura de cada aba — assim "Lançamentos" nunca vira "Lançament…".
 */
export function tamanhoDaLetraDoMenu(larguraDaTela: number, escalaDaLetra: number): number {
  const menu = Math.min(larguraDaTela - 28, 560) - 8;
  const porAba = (menu - LARGURA_DO_MAIS) / (ABAS.length - 1);
  const cabe = (porAba - 4) / (MAIOR_NOME * 0.62);
  return Math.max(8, Math.min(11 * Math.min(escalaDaLetra || 1, 1.15), cabe));
}

/** Altura que o conteúdo das telas precisa deixar livre embaixo para o menu não cobrir nada. */
export const ESPACO_DO_MENU = 120;

function useTecladoAberto(): boolean {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const a = Keyboard.addListener('keyboardDidShow', () => setAberto(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setAberto(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return aberto;
}

/** Menu flutuante embaixo: Início · Lançamentos · (+) · Dashboard · Mais */
export function MenuFlutuante({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const c = useCores();
  const teclado = useTecladoAberto();
  const tela = useWindowDimensions();
  const letra = tamanhoDaLetraDoMenu(tela.width, tela.fontScale);
  if (teclado) return null;

  function ir(nome: string) {
    const i = state.routes.findIndex((r) => r.name === nome);
    const rota = state.routes[i];
    if (!rota) return;
    toque.leve();
    const evento = emitter.emit({ type: 'tabPress', target: rota.key, canPreventDefault: true });
    if (i !== state.index && !evento.defaultPrevented) navigateToTab(rota.key);
  }

  const atual = state.routes[state.index]?.name;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 10, paddingHorizontal: 14, alignItems: 'center' }}>
      <View
        accessibilityRole="tablist"
        style={{
          width: '100%', maxWidth: 560, height: 66, borderRadius: 33, backgroundColor: c.cartao, flexDirection: 'row',
          alignItems: 'center', paddingHorizontal: 4, borderWidth: c.escuro ? 1 : 0, borderColor: c.borda,
          boxShadow: c.escuro ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 26px rgba(40,28,24,0.18)',
        }}>
        {ABAS.map((aba) => {
          const focada = atual === aba.nome;
          if (aba.nome === 'novo') {
            return (
              <View key={aba.nome} style={{ width: LARGURA_DO_MAIS, alignItems: 'center' }}>
                <Pressable
                  testID={aba.testID}
                  accessibilityRole="button"
                  accessibilityLabel="Novo lançamento"
                  accessibilityState={{ selected: focada }}
                  onPress={() => ir(aba.nome)}
                  style={({ pressed }) => ({ marginTop: -30, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
                  <Degrade
                    cores={['#FF9A2E', '#E87400']}
                    style={{
                      width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
                      borderWidth: 4, borderColor: c.fundo, boxShadow: '0 8px 18px rgba(232,116,0,0.45)',
                    }}>
                    <Ionicons name="add" size={34} color="#FFFFFF" />
                  </Degrade>
                </Pressable>
              </View>
            );
          }
          const cor = focada ? c.laranjaEscuro : c.textoSuave;
          return (
            <Pressable
              key={aba.nome}
              testID={aba.testID}
              accessibilityRole="tab"
              accessibilityLabel={aba.titulo}
              accessibilityState={{ selected: focada }}
              onPress={() => ir(aba.nome)}
              style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', height: 60, opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name={focada ? aba.cheio : aba.vazado} size={23} color={cor} />
              {/* Com a letra do celular aumentada, o nome encolhe um pouco em vez de virar "Lançament…". */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                allowFontScaling={false}
                style={{ fontFamily: focada ? FONTE.forte : FONTE.media, fontSize: letra, color: cor, marginTop: 2, paddingHorizontal: 1, textAlign: 'center' }}>
                {aba.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
