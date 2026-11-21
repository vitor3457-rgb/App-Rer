import { Tabs } from 'expo-router/js-tabs';
import React from 'react';

import { MenuFlutuante } from '@/ui/MenuFlutuante';
import { useCores } from '@/ui/tema';

/** Abas do app com o menu flutuante (o botão "+" do meio abre o Novo lançamento). */
export default function Abas() {
  const c = useCores();
  return (
    <Tabs
      tabBar={(props) => <MenuFlutuante {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.fundo } }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="lancamentos" options={{ title: 'Lançamentos' }} />
      <Tabs.Screen name="novo" options={{ title: 'Novo lançamento' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais' }} />
    </Tabs>
  );
}
