import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/**
 * Lembrete semanal ("Hora de lançar as ofertas e os dízimos"): uma notificação do
 * próprio celular, no dia e na hora escolhidos. Não depende de internet nem de servidor.
 */

export interface Lembrete {
  ativo: boolean;
  /** 1 = domingo ... 7 = sábado */
  diaSemana: number;
  hora: number;
  minuto: number;
}

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PADRAO: Lembrete = { ativo: false, diaSemana: 1, hora: 20, minuto: 0 };
const CHAVE = 'adrer:lembrete';
const CANAL = 'lembretes';
export const LEMBRETE_DISPONIVEL = Platform.OS !== 'web';

const loja = createStore<Lembrete>(() => PADRAO);

export function useLembrete(): Lembrete {
  return useStore(loja, (e) => e);
}

export function textoLembrete(l: Lembrete): string {
  if (!l.ativo) return 'Desligado';
  return DIAS_SEMANA[l.diaSemana - 1] + ' às ' + ('0' + l.hora).slice(-2) + ':' + ('0' + l.minuto).slice(-2);
}

async function notificacoes() {
  // Carregado só quando necessário (não existe no navegador).
  return await import('expo-notifications');
}

export async function iniciarLembrete(): Promise<void> {
  try {
    const salvo = await AsyncStorage.getItem(CHAVE);
    if (salvo) loja.setState({ ...PADRAO, ...JSON.parse(salvo) });
  } catch {
    /* fica no padrão */
  }
  if (!LEMBRETE_DISPONIVEL) return;
  try {
    const N = await notificacoes();
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch {
    /* sem notificações neste aparelho */
  }
}

/** Liga, desliga ou muda o horário do lembrete. Lança erro com mensagem clara se não for possível. */
export async function salvarLembrete(novo: Lembrete): Promise<void> {
  if (LEMBRETE_DISPONIVEL) {
    const N = await notificacoes();
    if (novo.ativo) {
      let permissao = await N.getPermissionsAsync();
      if (!permissao.granted) permissao = await N.requestPermissionsAsync();
      if (!permissao.granted) {
        throw new Error('Para receber o lembrete, permita as notificações do ADRER nas configurações do celular.');
      }
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync(CANAL, { name: 'Lembretes', importance: N.AndroidImportance.DEFAULT });
      }
    }
    await N.cancelAllScheduledNotificationsAsync();
    if (novo.ativo) {
      await N.scheduleNotificationAsync({
        content: {
          title: 'ADRER · Lançamentos da semana',
          body: 'Hora de registrar os dízimos, as ofertas e as despesas.',
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday: novo.diaSemana,
          hour: novo.hora,
          minute: novo.minuto,
          channelId: CANAL,
        },
      });
    }
  }
  loja.setState(novo);
  await AsyncStorage.setItem(CHAVE, JSON.stringify(novo));
}
