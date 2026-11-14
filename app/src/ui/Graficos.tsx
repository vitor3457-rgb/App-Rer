import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { formatarReais } from '@/core/dinheiro';
import { Grafico, GraficoLinha } from '@/core/graficos';
import { Dia } from '@/core/totais';

import { FONTE, useCores } from './tema';

/** Desenha um gráfico (texto SVG) ocupando a largura disponível. */
export function Desenho({ grafico, testID, descricao }: { grafico: Grafico; testID?: string; descricao: string }) {
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={descricao} style={{ width: '100%', aspectRatio: grafico.largura / grafico.altura }}>
      <SvgXml xml={grafico.xml} width="100%" height="100%" />
    </View>
  );
}

/** Gráfico de linha em que tocar (ou arrastar o dedo) mostra o saldo do dia. */
export function LinhaComToque({ grafico, dias, testID, descricao }: { grafico: GraficoLinha; dias: Dia[]; testID?: string; descricao: string }) {
  const c = useCores();
  const [largura, setLargura] = useState(0);
  const [indice, setIndice] = useState<number | null>(null);

  function escolher(x: number) {
    if (!largura || !dias.length) return;
    const noDesenho = (x / largura) * grafico.largura;
    let melhor = 0;
    dias.forEach((_, i) => {
      if (Math.abs(grafico.px(i) - noDesenho) < Math.abs(grafico.px(melhor) - noDesenho)) melhor = i;
    });
    setIndice(melhor);
  }

  const escala = largura ? largura / grafico.largura : 0;
  const dia = indice !== null ? dias[indice] : null;
  const x = dia && indice !== null ? grafico.px(indice) * escala : 0;
  const y = dia ? grafico.py(dia.saldo) * escala : 0;
  const larguraDica = 190;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={descricao}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => escolher(e.nativeEvent.locationX)}
      onResponderMove={(e) => escolher(e.nativeEvent.locationX)}
      style={{ width: '100%', aspectRatio: grafico.largura / grafico.altura }}>
      <View pointerEvents="none" style={{ flex: 1 }}>
        <SvgXml xml={grafico.xml} width="100%" height="100%" />
      </View>
      {dia ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', left: x - 0.5, top: 8, bottom: 22, width: 1, backgroundColor: c.textoSuave, opacity: 0.6 }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: x - 7, top: y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: c.laranjaEscuro, borderWidth: 2, borderColor: c.cartao }} />
          <View
            testID="dica-grafico"
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: Math.max(0, Math.min(largura - larguraDica, x - larguraDica / 2)), width: larguraDica,
              backgroundColor: c.escuro ? '#F6F1EE' : '#1C1716', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
            }}>
            <Text style={{ fontFamily: FONTE.forte, fontSize: 13, color: c.escuro ? '#1C1716' : '#FFFFFF' }}>Dia {dia.dia} · caixa {formatarReais(dia.saldo)}</Text>
            {dia.temLancamento ? (
              <Text style={{ fontFamily: FONTE.normal, fontSize: 12, color: c.escuro ? '#1C1716' : '#FFFFFF' }}>entrou {formatarReais(dia.entrou)} · saiu {formatarReais(dia.saiu)}</Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}
