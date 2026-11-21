import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NOME_APP } from '@/config';
import { banco } from '@/dados';
import { useBanco } from '@/dados/hooks';

import { avisar, avisarErro } from './avisos';
import { Texto } from './base';
import { ESPACO, FONTE, useCores } from './tema';
import { toque } from './toque';

/** Etiqueta do topo: mostra se está tudo enviado, enviando ou sem internet. Tocar tenta sincronizar. */
export function ChipSinc() {
  const c = useCores();
  const sinc = useBanco((e) => e.sinc);
  const pendentes = useBanco((e) => e.fila.length);

  let icone: keyof typeof Ionicons.glyphMap = 'cloud-done';
  let texto = 'Sincronizado';
  let cor = c.entrada;
  let fundo = c.entradaSuave;
  if (sinc.andamento) {
    texto = pendentes ? 'Enviando…' : 'Atualizando…';
    cor = c.textoSuave;
    fundo = c.rochaSuave;
  } else if (sinc.erro) {
    icone = 'alert-circle';
    texto = 'Erro ao sincronizar';
    cor = c.saida;
    fundo = c.saidaSuave;
  } else if (!sinc.online) {
    icone = 'cloud-offline';
    texto = pendentes ? `Sem internet · ${pendentes} a enviar` : 'Sem internet';
    cor = c.aviso;
    fundo = c.avisoSuave;
  } else if (pendentes) {
    icone = 'cloud-upload';
    texto = `${pendentes} a enviar`;
    cor = c.aviso;
    fundo = c.avisoSuave;
  }

  async function tocar() {
    toque.leve();
    await banco.sincronizar();
    const e = banco.loja.getState();
    if (e.sinc.erro) avisarErro(e.sinc.erro);
    else if (!e.sinc.online) avisarErro('Sem internet. Seus lançamentos ficam guardados no celular e são enviados quando a conexão voltar.');
    else avisar('Tudo sincronizado.');
  }

  return (
    <Pressable
      testID="chip-sinc"
      accessibilityRole="button"
      accessibilityLabel={'Sincronização: ' + texto}
      onPress={tocar}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: fundo, borderRadius: 16, paddingHorizontal: 10, minHeight: 32 }}>
      {sinc.andamento ? <ActivityIndicator size="small" color={cor} /> : <Ionicons name={icone} size={16} color={cor} />}
      <Text style={{ fontFamily: FONTE.media, fontSize: 12, color: cor }}>{texto}</Text>
    </Pressable>
  );
}

/** Topo das telas principais: logo, nome (ou saudação) e estado da sincronização. */
export function Cabecalho({ saudacao }: { saudacao?: string } = {}) {
  const c = useCores();
  const margens = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.fundo, paddingTop: margens.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.m, paddingHorizontal: ESPACO.g, paddingTop: ESPACO.m, paddingBottom: ESPACO.p, maxWidth: 592, width: '100%', alignSelf: 'center' }}>
        <Image source={require('@/assets/images/logo.png')} style={{ width: 58, height: 36 }} contentFit="contain" accessibilityLabel="Logo da igreja" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="cabecalho-titulo" numberOfLines={1} style={{ fontFamily: FONTE.preta, fontSize: saudacao ? 19 : 21, letterSpacing: saudacao ? 0 : 1.2, color: c.texto, lineHeight: 25 }}>
            {saudacao ? 'Olá, ' + saudacao : NOME_APP}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontFamily: FONTE.media, fontSize: 12, color: c.textoSuave }}>{saudacao ? NOME_APP + ' · Controle financeiro' : 'Controle financeiro'}</Text>
        </View>
        <ChipSinc />
      </View>
    </View>
  );
}

/** Topo das telas internas: seta de voltar e título. */
export function CabecalhoVoltar({ titulo, direita }: { titulo: string; direita?: React.ReactNode }) {
  const c = useCores();
  const margens = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.cartao, paddingTop: margens.top, borderBottomWidth: 1, borderBottomColor: c.borda }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: ESPACO.p, maxWidth: 592, width: '100%', alignSelf: 'center' }}>
        <Pressable
          testID="voltar"
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={24} color={c.texto} />
        </Pressable>
        <Texto tipo="subtitulo" style={{ flex: 1 }} numberOfLines={1}>{titulo}</Texto>
        {direita}
      </View>
    </View>
  );
}

/** Corpo rolável de uma tela, com largura máxima (fica bom também em tela grande). */
export function Corpo({
  children, puxarParaAtualizar, espacoInferior = 32, testID,
}: { children: React.ReactNode; puxarParaAtualizar?: boolean; espacoInferior?: number; testID?: string }) {
  const c = useCores();
  const [atualizando, setAtualizando] = React.useState(false);
  async function atualizar() {
    setAtualizando(true);
    await banco.sincronizar();
    setAtualizando(false);
  }
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: c.fundo }}
      contentContainerStyle={{ padding: ESPACO.g, paddingBottom: espacoInferior, gap: ESPACO.g, maxWidth: 592, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      refreshControl={puxarParaAtualizar ? <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={c.laranja} colors={[c.laranja]} /> : undefined}>
      {children}
    </ScrollView>
  );
}
