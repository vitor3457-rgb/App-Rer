import React from 'react';
import { View } from 'react-native';

import { Texto } from '@/ui/base';
import { Cabecalho, Corpo } from '@/ui/Tela';

export default function Provisoria() {
  return (
    <View style={{ flex: 1 }}>
      <Cabecalho />
      <Corpo><Texto tipo="titulo">mais</Texto></Corpo>
    </View>
  );
}
