import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { banco, sair } from '@/dados';
import { useBanco, useSessao } from '@/dados/hooks';
import { Botao, Texto } from '@/ui/base';
import { ESPACO, useCores } from '@/ui/tema';

/** A pessoa entrou com o Google, mas (ainda) não sabemos se a conta está na lista da igreja. */
export default function SemAcesso() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const conta = useSessao((e) => e.conta);
  const conhecida = useBanco((e) => e.autorizacaoConhecida);
  const sinc = useBanco((e) => e.sinc);
  const [tentando, setTentando] = useState(false);

  const conferindo = !conhecida && (sinc.andamento || (sinc.online && !sinc.erro));
  const semInternet = !conhecida && !conferindo;

  async function tentar() {
    setTentando(true);
    await banco.sincronizar();
    setTentando(false);
  }

  return (
    <View testID="tela-sem-acesso" style={{ flex: 1, backgroundColor: c.fundo, paddingTop: margens.top, paddingBottom: margens.bottom }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: ESPACO.xg, gap: ESPACO.g, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        {conferindo ? (
          <View style={{ alignItems: 'center', gap: ESPACO.g }}>
            <ActivityIndicator size="large" color={c.laranja} />
            <Texto tipo="subtitulo">Conferindo o seu acesso…</Texto>
          </View>
        ) : (
          <>
            <Ionicons name={semInternet ? 'cloud-offline' : 'lock-closed'} size={48} color={semInternet ? c.aviso : c.saida} style={{ alignSelf: 'center' }} />
            <Texto tipo="titulo" style={{ textAlign: 'center' }}>
              {semInternet ? 'Sem internet' : 'Acesso não autorizado'}
            </Texto>
            {semInternet ? (
              <Texto style={{ textAlign: 'center' }}>
                No primeiro acesso é preciso estar conectado para conferir a sua conta. Verifique o Wi-Fi ou os dados móveis e tente de novo.
              </Texto>
            ) : (
              <>
                <Texto style={{ textAlign: 'center' }}>
                  Você entrou com a conta <Texto tipo="rotulo">{conta?.email}</Texto>, que não está na lista de usuários do app.
                </Texto>
                <Texto suave style={{ textAlign: 'center' }}>
                  Se a conta está certa, peça ao administrador para incluir esse e-mail (Mais → Usuários). Se você tem outra conta Google, saia e entre com ela.
                </Texto>
              </>
            )}
            {sinc.erro ? <Texto tipo="pequeno" suave style={{ textAlign: 'center' }}>{sinc.erro}</Texto> : null}
            <Botao testID="tentar-de-novo" titulo="Tentar de novo" icone="refresh" carregando={tentando} onPress={tentar} />
            <Botao testID="sair" titulo="Sair e usar outra conta" tipo="secundario" icone="log-out-outline" onPress={() => void sair(true)} />
          </>
        )}
      </View>
    </View>
  );
}
