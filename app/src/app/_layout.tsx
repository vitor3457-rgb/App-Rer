import {
  Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { iniciarDados } from '@/dados';
import { ligarGatilhos } from '@/dados/gatilhos';
import { useBanco, useSessao } from '@/dados/hooks';
import { CamadaDeAvisos } from '@/ui/avisos';
import { iniciarLembrete } from '@/ui/lembrete';
import { carregarTema, useCores } from '@/ui/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Raiz() {
  const [fontes, erroFontes] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const c = useCores();
  const fase = useSessao((e) => e.fase);
  const usuario = useBanco((e) => e.usuario);

  useEffect(() => {
    void carregarTema();
    void iniciarDados();
    ligarGatilhos();
    void iniciarLembrete();
  }, []);

  const pronto = (fontes || !!erroFontes) && fase !== 'iniciando';
  useEffect(() => {
    if (pronto) SplashScreen.hideAsync().catch(() => {});
  }, [pronto]);
  if (!pronto) return null;

  const dentro = fase === 'dentro';
  const autorizado = dentro && !!usuario;

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <StatusBar style={c.escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fundo } }}>
        <Stack.Protected guard={autorizado}>
          <Stack.Screen name="(abas)" />
          <Stack.Screen name="lancamento/[id]" />
          <Stack.Screen name="membros/index" />
          <Stack.Screen name="membros/[id]" />
          <Stack.Screen name="ajustes/usuarios" />
          <Stack.Screen name="ajustes/responsaveis" />
        </Stack.Protected>
        <Stack.Protected guard={dentro && !autorizado}>
          <Stack.Screen name="sem-acesso" />
        </Stack.Protected>
        <Stack.Protected guard={!dentro}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Screen name="entrar" />
      </Stack>
      <CamadaDeAvisos />
    </View>
  );
}
