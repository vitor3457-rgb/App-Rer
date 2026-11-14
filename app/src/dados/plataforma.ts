import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { Armazenamento } from './armazenamento';

/** Peças que dependem do aparelho (celular ou navegador). */

export const armazenamentoAparelho: Armazenamento = {
  async ler(chaves) {
    const saida: Record<string, string | null> = {};
    if (!chaves.length) return saida;
    for (const [chave, valor] of await AsyncStorage.multiGet(chaves)) saida[chave] = valor;
    return saida;
  },
  async gravar(pares) {
    const lista = Object.entries(pares);
    if (lista.length) await AsyncStorage.multiSet(lista);
  },
  async remover(chaves) {
    if (chaves.length) await AsyncStorage.multiRemove(chaves);
  },
  async chaves(prefixo) {
    return (await AsyncStorage.getAllKeys()).filter((c) => c.startsWith(prefixo));
  },
};

export function novoId(): string {
  return Crypto.randomUUID();
}

/** Conteúdo de um arquivo local (foto) para enviar ao servidor. */
export async function lerArquivo(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  const arquivo = new File(uri);
  if (!arquivo.exists) throw new Error('Arquivo não encontrado: ' + uri);
  return arquivo.arrayBuffer();
}

export async function removerArquivo(uri: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const arquivo = new File(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    /* já não existe */
  }
}
