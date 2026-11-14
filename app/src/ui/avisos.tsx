import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { Botao, Texto } from './base';
import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

/** Mensagens rápidas ("Lançamento salvo!") e perguntas de confirmação, chamadas de qualquer tela. */

interface Aviso { id: number; texto: string; detalhe?: string; tipo: 'ok' | 'erro' }
interface Pergunta {
  titulo: string; mensagem?: string; detalhes?: string[]; confirmar: string; cancelar?: string; perigo?: boolean;
  responder: (sim: boolean) => void;
}

const loja = createStore<{ aviso: Aviso | null; pergunta: Pergunta | null }>(() => ({ aviso: null, pergunta: null }));
let serie = 0;

export function avisar(texto: string, detalhe?: string) {
  toque.sucesso();
  loja.setState({ aviso: { id: ++serie, texto, detalhe, tipo: 'ok' } });
}

export function avisarErro(texto: string) {
  toque.erro();
  loja.setState({ aviso: { id: ++serie, texto, tipo: 'erro' } });
}

/** Mostra uma pergunta com dois botões e devolve true se a pessoa confirmou. */
export function perguntar(opcoes: Omit<Pergunta, 'responder'>): Promise<boolean> {
  toque.alerta();
  return new Promise((resolve) => {
    loja.setState({ pergunta: { ...opcoes, responder: (sim) => { loja.setState({ pergunta: null }); resolve(sim); } } });
  });
}

/** Fica no topo do app (uma vez só) e desenha os avisos e as perguntas. */
export function CamadaDeAvisos() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const aviso = useStore(loja, (e) => e.aviso);
  const pergunta = useStore(loja, (e) => e.pergunta);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => {
      if (loja.getState().aviso?.id === aviso.id) loja.setState({ aviso: null });
    }, aviso.tipo === 'erro' ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <>
      {aviso ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: margens.bottom + 84, alignItems: 'center', paddingHorizontal: ESPACO.g }}>
          <Pressable
            testID="aviso"
            accessibilityRole="alert"
            onPress={() => loja.setState({ aviso: null })}
            style={{
              maxWidth: 528, width: '100%', flexDirection: 'row', gap: ESPACO.m, alignItems: 'flex-start',
              backgroundColor: aviso.tipo === 'erro' ? '#8C1219' : '#14532D', borderRadius: RAIO.m, padding: ESPACO.g,
              boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
            }}>
            <Ionicons name={aviso.tipo === 'erro' ? 'alert-circle' : 'checkmark-circle'} size={22} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTE.forte, fontSize: 16, color: '#FFFFFF' }}>{aviso.texto}</Text>
              {aviso.detalhe ? <Text style={{ fontFamily: FONTE.normal, fontSize: 14, lineHeight: 19, color: '#FFFFFF', marginTop: 2 }}>{aviso.detalhe}</Text> : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!pergunta} transparent animationType="fade" onRequestClose={() => pergunta?.responder(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: c.fundoModal, alignItems: 'center', justifyContent: 'center', padding: ESPACO.g }} onPress={() => pergunta?.responder(false)}>
          <Pressable
            testID="pergunta"
            accessibilityRole="alert"
            onPress={() => {}}
            style={{ width: '100%', maxWidth: 440, backgroundColor: c.cartao, borderRadius: RAIO.g, padding: ESPACO.xg, gap: ESPACO.m }}>
            <Texto tipo="subtitulo" style={{ fontSize: 20 }}>{pergunta?.titulo}</Texto>
            {pergunta?.detalhes?.length ? (
              <View style={{ backgroundColor: c.cartaoSuave, borderRadius: RAIO.p, padding: ESPACO.m, gap: 2 }}>
                {pergunta.detalhes.map((linha, i) => (
                  <Texto key={i} tipo={i === 0 ? 'rotulo' : 'pequeno'}>{linha}</Texto>
                ))}
              </View>
            ) : null}
            {pergunta?.mensagem ? <Texto suave>{pergunta.mensagem}</Texto> : null}
            <View style={{ flexDirection: 'row', gap: ESPACO.m, marginTop: ESPACO.p }}>
              <Botao testID="pergunta-cancelar" titulo={pergunta?.cancelar ?? 'Cancelar'} tipo="secundario" onPress={() => pergunta?.responder(false)} style={{ flex: 1 }} />
              <Botao testID="pergunta-confirmar" titulo={pergunta?.confirmar ?? 'Sim'} tipo={pergunta?.perigo ? 'perigo' : 'principal'} onPress={() => pergunta?.responder(true)} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
