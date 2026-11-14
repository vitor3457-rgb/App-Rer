import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { banco, sessao } from './index';

/** Quando sincronizar sozinho: ao abrir o app, quando a internet volta e de tempos em tempos. */
let ligado = false;

export function ligarGatilhos(): void {
  if (ligado) return;
  ligado = true;

  const dentro = () => sessao.getState().fase === 'dentro';

  try {
    Network.addNetworkStateListener((estado) => {
      if (!dentro()) return;
      const online = estado.isConnected !== false && estado.isInternetReachable !== false;
      banco.definirOnline(online);
    });
  } catch {
    /* sem aviso de rede neste aparelho: os outros gatilhos resolvem */
  }

  AppState.addEventListener('change', (estado) => {
    if (estado === 'active' && dentro()) void banco.sincronizar();
  });

  setInterval(() => {
    if (AppState.currentState === 'active' && dentro()) void banco.sincronizar();
  }, 60_000);
}
