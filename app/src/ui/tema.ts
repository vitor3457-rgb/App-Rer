import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** Cores e medidas do app, no tema da igreja (laranja, cinza da rocha e preto). */

export interface Cores {
  escuro: boolean;
  fundo: string;
  cartao: string;
  cartaoSuave: string;
  texto: string;
  textoSuave: string;
  borda: string;
  laranja: string;
  laranjaEscuro: string;
  laranjaSuave: string;
  /** Texto em cima do laranja. */
  sobreLaranja: string;
  rocha: string;
  rochaSuave: string;
  entrada: string;
  entradaSuave: string;
  saida: string;
  saidaSuave: string;
  aviso: string;
  avisoSuave: string;
  sombra: string;
  fundoModal: string;
}

export const CLARO: Cores = {
  escuro: false,
  fundo: '#F6F3F2',
  cartao: '#FFFFFF',
  cartaoSuave: '#F3EFEE',
  texto: '#1C1716',
  textoSuave: '#6B5F5C',
  borda: '#D8CFCC',
  laranja: '#FF8708',
  laranjaEscuro: '#C45C00',
  laranjaSuave: '#FFF0E0',
  sobreLaranja: '#1C1716',
  rocha: '#4F4643',
  rochaSuave: '#ECE6E4',
  entrada: '#1A7A38',
  entradaSuave: '#E3F4E8',
  saida: '#C0262D',
  saidaSuave: '#FDE9EA',
  aviso: '#8A5A00',
  avisoSuave: '#FFF4D6',
  sombra: '#281C18',
  fundoModal: 'rgba(15, 12, 11, 0.55)',
};

export const ESCURO: Cores = {
  escuro: true,
  fundo: '#141110',
  cartao: '#211D1B',
  cartaoSuave: '#2B2623',
  texto: '#F6F1EE',
  textoSuave: '#B8ABA6',
  borda: '#403835',
  laranja: '#FF8708',
  laranjaEscuro: '#FFA94D',
  laranjaSuave: '#3A2814',
  sobreLaranja: '#1C1716',
  rocha: '#D9CFCB',
  rochaSuave: '#2F2927',
  entrada: '#5FD08A',
  entradaSuave: '#17301F',
  saida: '#FF7B7B',
  saidaSuave: '#3A1B1D',
  aviso: '#FFD27A',
  avisoSuave: '#3A2E12',
  sombra: '#000000',
  fundoModal: 'rgba(0, 0, 0, 0.65)',
};

export const ESPACO = { xs: 4, p: 8, m: 12, g: 16, xg: 24 };
export const RAIO = { p: 10, m: 14, g: 20 };

/** Fontes (Inter). Os nomes batem com os arquivos carregados no início do app. */
export const FONTE = {
  normal: 'Inter_400Regular',
  media: 'Inter_600SemiBold',
  forte: 'Inter_700Bold',
  preta: 'Inter_800ExtraBold',
};

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';
const CHAVE = 'adrer:tema';

export const lojaTema = createStore<{ preferencia: PreferenciaTema }>(() => ({ preferencia: 'sistema' }));

export async function carregarTema(): Promise<void> {
  try {
    const salvo = await AsyncStorage.getItem(CHAVE);
    if (salvo === 'claro' || salvo === 'escuro' || salvo === 'sistema') lojaTema.setState({ preferencia: salvo });
  } catch {
    /* fica no padrão */
  }
}

export function definirTema(preferencia: PreferenciaTema): void {
  lojaTema.setState({ preferencia });
  AsyncStorage.setItem(CHAVE, preferencia).catch(() => {});
}

export function usePreferenciaTema(): PreferenciaTema {
  return useStore(lojaTema, (e) => e.preferencia);
}

/** Cores atuais (seguem o celular, ou a escolha feita em Mais → Aparência). */
export function useCores(): Cores {
  const preferencia = usePreferenciaTema();
  const sistema = useColorScheme();
  const escuro = preferencia === 'escuro' || (preferencia === 'sistema' && sistema === 'dark');
  return escuro ? ESCURO : CLARO;
}
