import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { MESES } from '@/core/datas';
import { formatarReais } from '@/core/dinheiro';
import { Lancamento } from '@/core/tipos';

import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

export function tituloDoLancamento(l: Lancamento): string {
  return l.tipo === 'Entrada' ? l.categoria + (l.descricao ? ' · ' + l.descricao : '') : l.descricao || l.categoria;
}

/** Uma linha da lista: data, o que foi, quem lançou e o valor (verde = entrada, vermelho = saída). */
export function ItemLancamento({
  l, aoAbrir, aoExcluir, mostrarAno,
}: { l: Lancamento; aoAbrir?: () => void; aoExcluir?: () => void; mostrarAno?: boolean }) {
  const c = useCores();
  const entrada = l.tipo === 'Entrada';
  const cor = entrada ? c.entrada : c.saida;
  const mes = (MESES[Number(l.dataReferencia.slice(5, 7)) - 1] ?? '').slice(0, 3).toLowerCase();
  return (
    <Pressable
      testID="item-lancamento"
      accessibilityRole="button"
      accessibilityLabel={`${tituloDoLancamento(l)}, ${entrada ? 'entrada' : 'saída'} de ${formatarReais(l.valorCentavos)}`}
      disabled={!aoAbrir}
      onPress={() => { toque.leve(); aoAbrir?.(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: ESPACO.m, backgroundColor: c.cartao, borderRadius: RAIO.m,
        borderLeftWidth: 5, borderLeftColor: cor, paddingVertical: 10, paddingLeft: ESPACO.m, paddingRight: aoExcluir ? 4 : ESPACO.m,
        borderWidth: c.escuro ? 1 : 0, borderColor: c.borda, opacity: pressed ? 0.75 : 1,
        boxShadow: c.escuro ? undefined : '0 1px 3px rgba(40,28,24,0.08)',
      })}>
      <View style={{ width: 40, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTE.preta, fontSize: 20, lineHeight: 22, color: c.texto }}>{l.dataReferencia.slice(8, 10)}</Text>
        <Text style={{ fontFamily: FONTE.media, fontSize: 12, color: c.textoSuave }}>{mes}{mostrarAno ? '/' + l.dataReferencia.slice(2, 4) : ''}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FONTE.forte, fontSize: 16, lineHeight: 21, color: c.texto }} numberOfLines={2}>{tituloDoLancamento(l)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: FONTE.normal, fontSize: 13, color: c.textoSuave }}>{entrada ? 'Entrada' : 'Saída'} · por {l.responsavel}</Text>
          {l.comprovante ? <Ionicons name="camera" size={13} color={c.textoSuave} accessibilityLabel="Tem foto" /> : null}
          {l.pendente ? (
            <View testID="item-pendente" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.avisoSuave, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Ionicons name="time-outline" size={12} color={c.aviso} />
              <Text style={{ fontFamily: FONTE.media, fontSize: 11, color: c.aviso }}>a enviar</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text testID="item-valor" style={{ fontFamily: FONTE.preta, fontSize: 16, color: cor, fontVariant: ['tabular-nums'] }}>
        {entrada ? '+ ' : '- '}{formatarReais(l.valorCentavos)}
      </Text>
      {aoExcluir ? (
        <Pressable
          testID="item-excluir"
          accessibilityRole="button"
          accessibilityLabel={'Excluir ' + tituloDoLancamento(l)}
          hitSlop={6}
          onPress={() => { toque.leve(); aoExcluir(); }}
          style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={20} color={c.textoSuave} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
