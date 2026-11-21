import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatarReais } from '@/core/dinheiro';
import { Lancamento } from '@/core/tipos';

import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

export function tituloDoLancamento(l: Lancamento): string {
  return l.tipo === 'Entrada' ? l.categoria + (l.descricao ? ' · ' + l.descricao : '') : l.descricao || l.categoria;
}

/** "PIX · por Alex" */
export function legendaPadrao(l: Lancamento): string {
  return (l.formaPagamento ? l.formaPagamento + ' · ' : '') + 'por ' + l.responsavel;
}

/**
 * Uma linha de lançamento: ícone (seta verde = entrada, vermelha = saída), o que foi,
 * a legenda e o valor. `emGrupo`: fica dentro de um cartão com outros (sem fundo próprio).
 * Tocar abre o detalhe; segurar o dedo pede para excluir.
 */
export function ItemLancamento({
  l, aoAbrir, aoSegurar, emGrupo, legenda,
}: { l: Lancamento; aoAbrir?: () => void; aoSegurar?: () => void; emGrupo?: boolean; legenda?: string }) {
  const c = useCores();
  const entrada = l.tipo === 'Entrada';
  const cor = entrada ? c.entrada : c.saida;
  return (
    <Pressable
      testID="item-lancamento"
      accessibilityRole="button"
      accessibilityLabel={`${tituloDoLancamento(l)}, ${entrada ? 'entrada' : 'saída'} de ${formatarReais(l.valorCentavos)}`}
      accessibilityHint={aoSegurar ? 'Toque para ver; segure para excluir' : undefined}
      disabled={!aoAbrir && !aoSegurar}
      onPress={() => { toque.leve(); aoAbrir?.(); }}
      onLongPress={aoSegurar ? () => { toque.alerta(); aoSegurar(); } : undefined}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: ESPACO.m, paddingVertical: 11, opacity: pressed ? 0.7 : 1 },
        emGrupo ? null : {
          backgroundColor: c.cartao, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m,
          borderWidth: c.escuro ? 1 : 0, borderColor: c.borda, boxShadow: c.escuro ? undefined : '0 2px 10px rgba(40,28,24,0.06)',
        },
      ]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: entrada ? c.entradaSuave : c.saidaSuave }}>
        <Ionicons name={entrada ? 'arrow-up' : 'arrow-down'} size={20} color={cor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FONTE.forte, fontSize: 15.5, lineHeight: 20, color: c.texto }} numberOfLines={2}>{tituloDoLancamento(l)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: FONTE.normal, fontSize: 12.5, color: c.textoSuave }} numberOfLines={2}>{legenda ?? legendaPadrao(l)}</Text>
          {l.comprovante ? <Ionicons name="camera" size={13} color={c.textoSuave} accessibilityLabel="Tem foto" /> : null}
          {l.pendente ? (
            <View testID="item-pendente" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.avisoSuave, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Ionicons name="time-outline" size={12} color={c.aviso} />
              <Text style={{ fontFamily: FONTE.media, fontSize: 11, color: c.aviso }}>a enviar</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text testID="item-valor" style={{ fontFamily: FONTE.preta, fontSize: 15.5, color: cor, fontVariant: ['tabular-nums'] }}>
        {entrada ? '+ ' : '- '}{formatarReais(l.valorCentavos)}
      </Text>
    </Pressable>
  );
}

/** Cartão com vários lançamentos, separados por uma linha fina. */
export function GrupoDeLancamentos({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const c = useCores();
  const itens = React.Children.toArray(children);
  return (
    <View testID={testID} style={{
      backgroundColor: c.cartao, borderRadius: RAIO.g, paddingHorizontal: ESPACO.m + 2, paddingVertical: 2,
      borderWidth: c.escuro ? 1 : 0, borderColor: c.borda, boxShadow: c.escuro ? undefined : '0 2px 10px rgba(40,28,24,0.06)',
    }}>
      {itens.map((item, i) => (
        <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: c.escuro ? c.borda : '#F0EBE9' } : undefined}>{item}</View>
      ))}
    </View>
  );
}
