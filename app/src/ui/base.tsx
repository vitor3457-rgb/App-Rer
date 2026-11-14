import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextProps, TextStyle, View, ViewStyle,
} from 'react-native';

import { ESPACO, FONTE, RAIO, useCores } from './tema';
import { toque } from './toque';

/** Componentes básicos, com letras e botões grandes (pensados para quem não é técnico). */

type Variante = 'titulo' | 'subtitulo' | 'corpo' | 'rotulo' | 'pequeno' | 'mini';
const ESTILO_TEXTO: Record<Variante, TextStyle> = {
  titulo: { fontFamily: FONTE.preta, fontSize: 24, lineHeight: 30 },
  subtitulo: { fontFamily: FONTE.forte, fontSize: 18, lineHeight: 24 },
  corpo: { fontFamily: FONTE.normal, fontSize: 16, lineHeight: 22 },
  rotulo: { fontFamily: FONTE.forte, fontSize: 15, lineHeight: 20 },
  pequeno: { fontFamily: FONTE.normal, fontSize: 14, lineHeight: 19 },
  mini: { fontFamily: FONTE.media, fontSize: 12, lineHeight: 16 },
};

export function Texto({ tipo = 'corpo', suave, cor, style, ...resto }: TextProps & { tipo?: Variante; suave?: boolean; cor?: string }) {
  const c = useCores();
  return <Text {...resto} style={[ESTILO_TEXTO[tipo], { color: cor ?? (suave ? c.textoSuave : c.texto) }, style]} />;
}

export function Cartao({ style, children, ...resto }: { style?: StyleProp<ViewStyle>; children: React.ReactNode; testID?: string }) {
  const c = useCores();
  return (
    <View
      {...resto}
      style={[{
        backgroundColor: c.cartao, borderRadius: RAIO.m, padding: ESPACO.g,
        boxShadow: c.escuro ? undefined : '0 1px 3px rgba(40,28,24,0.08), 0 2px 10px rgba(40,28,24,0.05)',
        borderWidth: c.escuro ? 1 : 0, borderColor: c.borda,
      }, style]}>
      {children}
    </View>
  );
}

type TipoBotao = 'principal' | 'secundario' | 'perigo' | 'suave';

export function Botao({
  titulo, onPress, tipo = 'principal', icone, carregando, desativado, style, testID, pequeno,
}: {
  titulo: string; onPress: () => void; tipo?: TipoBotao; icone?: keyof typeof Ionicons.glyphMap;
  carregando?: boolean; desativado?: boolean; style?: StyleProp<ViewStyle>; testID?: string; pequeno?: boolean;
}) {
  const c = useCores();
  const paleta = {
    principal: { fundo: c.laranja, texto: c.sobreLaranja, borda: c.laranja },
    secundario: { fundo: c.cartao, texto: c.texto, borda: c.borda },
    perigo: { fundo: c.saida, texto: c.escuro ? '#1C1716' : '#FFFFFF', borda: c.saida },
    suave: { fundo: c.rochaSuave, texto: c.texto, borda: c.rochaSuave },
  }[tipo];
  const parado = !!desativado || !!carregando;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: parado, busy: !!carregando }}
      disabled={parado}
      onPress={() => { toque.leve(); onPress(); }}
      style={({ pressed }) => [{
        minHeight: pequeno ? 44 : 56, borderRadius: RAIO.m, borderWidth: 2, borderColor: paleta.borda,
        backgroundColor: paleta.fundo, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: ESPACO.p, paddingHorizontal: ESPACO.g, opacity: parado ? 0.55 : pressed ? 0.8 : 1,
      }, style]}>
      {carregando ? <ActivityIndicator color={paleta.texto} /> : icone ? <Ionicons name={icone} size={pequeno ? 18 : 22} color={paleta.texto} /> : null}
      <Text style={{ fontFamily: FONTE.forte, fontSize: pequeno ? 15 : 17, color: paleta.texto }} numberOfLines={1}>{titulo}</Text>
    </Pressable>
  );
}

/** Botão grande de escolha (Entrada/Saída, Dízimo/Oferta...). */
export function BotaoOpcao({
  titulo, selecionado, onPress, cor, icone, erro, testID,
}: {
  titulo: string; selecionado: boolean; onPress: () => void; cor: string;
  icone?: keyof typeof Ionicons.glyphMap; erro?: boolean; testID?: string;
}) {
  const c = useCores();
  const sobre = c.escuro ? '#1C1716' : '#FFFFFF';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ selected: selecionado }}
      onPress={() => { toque.leve(); onPress(); }}
      style={({ pressed }) => ({
        flex: 1, minHeight: 60, borderRadius: RAIO.m, borderWidth: 2,
        borderColor: erro ? c.saida : selecionado ? cor : c.borda,
        backgroundColor: selecionado ? cor : c.cartao,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ESPACO.p,
        paddingHorizontal: ESPACO.p, opacity: pressed ? 0.85 : 1,
      })}>
      {icone ? <Ionicons name={icone} size={22} color={selecionado ? sobre : cor} /> : null}
      <Text style={{ fontFamily: FONTE.forte, fontSize: 17, color: selecionado ? sobre : cor }}>{titulo}</Text>
    </Pressable>
  );
}

export function Rotulo({ children, extra }: { children: React.ReactNode; extra?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: ESPACO.p, flexWrap: 'wrap' }}>
      <Texto tipo="rotulo">{children}</Texto>
      {extra ? <Texto tipo="pequeno" suave>{extra}</Texto> : null}
    </View>
  );
}

export function CampoTexto({
  erro, grande, style, onFocus, onBlur, ...resto
}: React.ComponentProps<typeof TextInput> & { erro?: boolean; grande?: boolean }) {
  const c = useCores();
  const [foco, setFoco] = React.useState(false);
  return (
    <TextInput
      placeholderTextColor={c.escuro ? '#8A7E79' : '#A39A97'}
      {...resto}
      onFocus={(e) => { setFoco(true); onFocus?.(e); }}
      onBlur={(e) => { setFoco(false); onBlur?.(e); }}
      style={[{
        minHeight: grande ? 72 : 56, borderRadius: RAIO.m, borderWidth: 2,
        borderColor: erro ? c.saida : foco ? c.laranja : c.borda, backgroundColor: c.cartao, color: c.texto,
        paddingHorizontal: ESPACO.g, paddingVertical: ESPACO.p,
        fontFamily: grande ? FONTE.preta : FONTE.media, fontSize: grande ? 30 : 17,
        textAlign: grande ? 'center' : 'left',
      }, style]}
    />
  );
}

/** Sugestões em "botõezinhos" (nomes já usados, despesas comuns...). */
export function Sugestoes({ itens, onEscolher, testID }: { itens: string[]; onEscolher: (texto: string) => void; testID?: string }) {
  const c = useCores();
  if (!itens.length) return null;
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.p, marginTop: ESPACO.p }}>
      {itens.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityLabel={item}
          onPress={() => { toque.leve(); onEscolher(item); }}
          style={({ pressed }) => ({
            minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 20,
            backgroundColor: c.cartaoSuave, borderWidth: 1, borderColor: c.borda, opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={{ fontFamily: FONTE.media, fontSize: 15, color: c.texto }}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MensagemErro({ texto, testID }: { texto: string | null; testID?: string }) {
  const c = useCores();
  if (!texto) return null;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        backgroundColor: c.saidaSuave, borderLeftWidth: 5, borderLeftColor: c.saida, borderRadius: RAIO.p,
        padding: ESPACO.m, flexDirection: 'row', gap: ESPACO.p, alignItems: 'flex-start',
      }}>
      <Ionicons name="alert-circle" size={20} color={c.saida} />
      <Text style={{ flex: 1, fontFamily: FONTE.media, fontSize: 15, lineHeight: 20, color: c.saida }}>{texto}</Text>
    </View>
  );
}

/** Linha "rótulo ........ valor" dos resumos. */
export function LinhaValor({
  rotulo, valor, cor, forte, recuo, testID,
}: { rotulo: string; valor: string; cor?: string; forte?: boolean; recuo?: boolean; testID?: string }) {
  const c = useCores();
  return (
    <View style={[estilos.linhaValor, { borderTopColor: c.borda, paddingLeft: recuo ? ESPACO.m : 0 }]}>
      <Text style={{ fontFamily: forte ? FONTE.forte : FONTE.normal, fontSize: recuo ? 15 : 16, color: cor ?? (recuo ? c.textoSuave : c.texto), flexShrink: 1 }}>{rotulo}</Text>
      <Text testID={testID} style={{ fontFamily: FONTE.forte, fontSize: recuo ? 15 : 16, color: cor ?? c.texto, fontVariant: ['tabular-nums'] }}>{valor}</Text>
    </View>
  );
}

/** Item de menu (tela "Mais"). */
export function ItemMenu({
  titulo, descricao, icone, onPress, valor, perigo, testID,
}: {
  titulo: string; descricao?: string; icone: keyof typeof Ionicons.glyphMap; onPress: () => void;
  valor?: string; perigo?: boolean; testID?: string;
}) {
  const c = useCores();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={() => { toque.leve(); onPress(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: ESPACO.m, minHeight: 60, paddingVertical: ESPACO.p,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: perigo ? c.saidaSuave : c.laranjaSuave, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={21} color={perigo ? c.saida : c.laranjaEscuro} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTE.forte, fontSize: 16, color: perigo ? c.saida : c.texto }}>{titulo}</Text>
        {descricao ? <Text style={{ fontFamily: FONTE.normal, fontSize: 13, lineHeight: 18, color: c.textoSuave }}>{descricao}</Text> : null}
      </View>
      {valor ? <Text style={{ fontFamily: FONTE.media, fontSize: 14, color: c.textoSuave }}>{valor}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={c.textoSuave} />
    </Pressable>
  );
}

export function Separador() {
  const c = useCores();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.borda }} />;
}

export function Vazio({ icone, titulo, texto }: { icone: keyof typeof Ionicons.glyphMap; titulo: string; texto?: string }) {
  const c = useCores();
  return (
    <View style={{ alignItems: 'center', paddingVertical: ESPACO.xg * 1.5, paddingHorizontal: ESPACO.g, gap: ESPACO.p }}>
      <Ionicons name={icone} size={44} color={c.borda} />
      <Texto tipo="subtitulo" style={{ textAlign: 'center' }}>{titulo}</Texto>
      {texto ? <Texto suave style={{ textAlign: 'center' }}>{texto}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linhaValor: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: ESPACO.m,
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
});
