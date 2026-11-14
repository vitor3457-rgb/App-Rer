import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODO_DEMO, NOME_COMPLETO } from '@/config';
import { entrar } from '@/dados';
import { useSessao } from '@/dados/hooks';
import { Botao, MensagemErro, Texto } from '@/ui/base';
import { ESPACO, useCores } from '@/ui/tema';

export default function Login() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const entrando = useSessao((e) => e.entrando);
  const erro = useSessao((e) => e.erro);

  return (
    <View testID="tela-login" style={{ flex: 1, backgroundColor: c.cartao, paddingTop: margens.top, paddingBottom: margens.bottom + ESPACO.g }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: ESPACO.xg, gap: ESPACO.g, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Image
          source={c.escuro ? require('@/assets/images/logo-completo-escuro.png') : require('@/assets/images/logo-completo.png')}
          style={{ width: 240, height: 190 }}
          contentFit="contain"
          accessibilityLabel="Logo da igreja Rocha Eterna dos Remidos"
        />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Texto tipo="titulo" style={{ textAlign: 'center' }}>Controle financeiro</Texto>
          <Texto suave style={{ textAlign: 'center' }}>{NOME_COMPLETO}</Texto>
        </View>
        <View style={{ height: 3, width: 64, backgroundColor: c.laranja, borderRadius: 2 }} />
        <MensagemErro texto={erro} testID="erro-login" />
        <Botao
          testID="entrar-google"
          titulo={MODO_DEMO ? 'Entrar (demonstração)' : 'Entrar com Google'}
          icone="logo-google"
          carregando={entrando}
          onPress={() => void entrar()}
          style={{ alignSelf: 'stretch' }}
        />
        <Texto tipo="pequeno" suave style={{ textAlign: 'center' }}>
          Só as contas autorizadas pela igreja conseguem acessar.
        </Texto>
      </View>
    </View>
  );
}
