import React from 'react';
import { View } from 'react-native';

import { CabecalhoVoltar, Corpo } from '@/ui/Tela';

export default function Provisoria() {
  return (
    <View style={{ flex: 1 }}>
      <CabecalhoVoltar titulo="Em construção" />
      <Corpo><View /></Corpo>
    </View>
  );
}
