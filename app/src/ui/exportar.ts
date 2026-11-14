import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { NOME_APP, NOME_COMPLETO } from '@/config';
import { dataHoraBR } from '@/core/datas';
import { Cabecalho } from '@/core/relatorios';
import { banco } from '@/dados';

import { LOGO_PDF } from './logoPdf';

/** Gera os arquivos (Excel/PDF) e abre a tela de compartilhar do celular (salvar, WhatsApp, e-mail...). */

export function cabecalhoRelatorio(): Cabecalho {
  const e = banco.loja.getState();
  return {
    nomeApp: NOME_APP,
    nomeCompleto: NOME_COMPLETO,
    logo: LOGO_PDF,
    geradoPor: e.usuario?.email ?? e.dono ?? '',
    geradoEm: dataHoraBR(new Date().toISOString()),
  };
}

async function compartilhar(arquivo: File, mimeType: string, titulo: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este aparelho não permite compartilhar arquivos.');
  }
  await Sharing.shareAsync(arquivo.uri, { mimeType, dialogTitle: titulo });
}

function arquivoNoCache(nome: string): File {
  const arquivo = new File(Paths.cache, nome);
  if (arquivo.exists) arquivo.delete();
  return arquivo;
}

export async function compartilharExcel(base64: string, nome: string): Promise<void> {
  const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = 'data:' + tipo + ';base64,' + base64;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const arquivo = arquivoNoCache(nome);
  await arquivo.write(base64, { encoding: 'base64' });
  await compartilhar(arquivo, tipo, nome);
}

export async function compartilharPdf(html: string, nome: string): Promise<void> {
  if (Platform.OS === 'web') {
    // No navegador: abre o relatório numa aba nova, pronta para imprimir ou salvar como PDF.
    const janela = window.open('', '_blank');
    if (!janela) throw new Error('O navegador bloqueou a nova aba. Permita pop-ups para este site.');
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    janela.document.title = nome;
    setTimeout(() => { try { janela.print(); } catch { /* a pessoa imprime pelo menu */ } }, 400);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 }); // A4
  const destino = arquivoNoCache(nome);
  await new File(uri).move(destino);
  await compartilhar(destino, 'application/pdf', nome);
}
