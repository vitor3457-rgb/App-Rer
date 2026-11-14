import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Pequenas vibrações de resposta ao toque (não fazem nada no navegador). */
const ativo = Platform.OS !== 'web';

export const toque = {
  leve() {
    if (ativo) Haptics.selectionAsync().catch(() => {});
  },
  sucesso() {
    if (ativo) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  erro() {
    if (ativo) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  alerta() {
    if (ativo) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};
