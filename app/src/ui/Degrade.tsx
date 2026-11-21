import React, { useId } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Fundo em degradê (desenhado com SVG, que já vem no app: não precisa instalar nada nativo). */
export function Degrade({
  cores, style, children, testID,
}: { cores: [string, string, string?]; style?: StyleProp<ViewStyle>; children?: React.ReactNode; testID?: string }) {
  const id = 'dg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [a, b, c] = cores;
  return (
    <View testID={testID} style={[{ overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          {c ? (
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={a} />
              <Stop offset="0.5" stopColor={b} />
              <Stop offset="1" stopColor={c} />
            </LinearGradient>
          ) : (
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={a} />
              <Stop offset="1" stopColor={b} />
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}
