import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { Texto } from './base';
import { ESPACO, RAIO, useCores } from './tema';

/** Janela por cima da tela (formulários curtos: novo membro, novo usuário...). */
export function Janela({
  visivel, titulo, aoFechar, children, testID,
}: { visivel: boolean; titulo: string; aoFechar: () => void; children: React.ReactNode; testID?: string }) {
  const c = useCores();
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: c.fundoModal, alignItems: 'center', justifyContent: 'center', padding: ESPACO.g }} onPress={aoFechar}>
          <Pressable testID={testID} onPress={() => {}} style={{ width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: c.cartao, borderRadius: RAIO.g, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: ESPACO.xg, paddingRight: ESPACO.p, paddingTop: ESPACO.m }}>
              <Texto tipo="subtitulo" style={{ flex: 1, fontSize: 20 }}>{titulo}</Texto>
              <Pressable testID="janela-fechar" accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={24} color={c.textoSuave} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: ESPACO.xg, paddingTop: ESPACO.m, gap: ESPACO.g }}>
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
