import React, { useId, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Fundo em degradê (desenhado com SVG, que já vem no app: não precisa instalar nada nativo).
 * O tamanho do desenho é medido de verdade (onLayout): no Android, com "100%", o SVG ficava
 * com o tamanho da primeira medida e o degradê aparecia cortado quando o cartão crescia.
 */
export function Degrade({
  cores, style, children, testID,
}: { cores: [string, string, string?]; style?: StyleProp<ViewStyle>; children?: React.ReactNode; testID?: string }) {
  const id = 'dg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [a, b, c] = cores;
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  function medir(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.ceil(width), h = Math.ceil(height);
    if (!tam || tam.w !== w || tam.h !== h) setTam({ w, h });
  }
  return (
    // Cor do meio por baixo: enquanto mede (e nas bordas arredondadas) nunca aparece um "buraco".
    <View testID={testID} onLayout={medir} style={[{ overflow: 'hidden', backgroundColor: c ? b : a }, style]}>
      {tam ? (
        <Svg key={tam.w + 'x' + tam.h} style={StyleSheet.absoluteFill} width={tam.w} height={tam.h} viewBox={`0 0 ${tam.w} ${tam.h}`}>
          <Defs>
            {c ? (
              <LinearGradient id={id} x1="0" y1="0" x2={tam.w} y2={tam.h} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={a} />
                <Stop offset="0.5" stopColor={b} />
                <Stop offset="1" stopColor={c} />
              </LinearGradient>
            ) : (
              <LinearGradient id={id} x1="0" y1="0" x2={tam.w} y2={tam.h} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={a} />
                <Stop offset="1" stopColor={b} />
              </LinearGradient>
            )}
          </Defs>
          <Rect x={0} y={0} width={tam.w} height={tam.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
