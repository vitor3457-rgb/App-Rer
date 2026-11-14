import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTE, useCores } from '@/ui/tema';

type Icone = keyof typeof Ionicons.glyphMap;

function icone(cheio: Icone, vazado: Icone) {
  function IconeDaAba({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? cheio : vazado} size={25} color={color as string} />;
  }
  return IconeDaAba;
}

/** Menu fixo embaixo: Novo · Lançamentos · Dashboard · Mais */
export default function Abas() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.laranjaEscuro,
        tabBarInactiveTintColor: c.textoSuave,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: c.cartao, borderTopColor: c.borda, borderTopWidth: 1,
          height: 64 + margens.bottom, paddingTop: 6, paddingBottom: margens.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: FONTE.media, fontSize: 12 },
        sceneStyle: { backgroundColor: c.fundo },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Novo', tabBarIcon: icone('add-circle', 'add-circle-outline'), tabBarButtonTestID: 'aba-novo', tabBarAccessibilityLabel: 'Novo lançamento' }} />
      <Tabs.Screen name="lancamentos" options={{ title: 'Lançamentos', tabBarIcon: icone('list', 'list-outline'), tabBarButtonTestID: 'aba-lancamentos' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: icone('bar-chart', 'bar-chart-outline'), tabBarButtonTestID: 'aba-dashboard' }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: icone('menu', 'menu-outline'), tabBarButtonTestID: 'aba-mais' }} />
    </Tabs>
  );
}
