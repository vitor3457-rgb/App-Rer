import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Foto de comprovante: tira/escolhe a foto, diminui (para gastar pouca internet e espaço)
 * e guarda numa pasta do app até ser enviada.
 */
export async function escolherFoto(origem: 'camera' | 'galeria'): Promise<string | null> {
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      throw new Error('Para fotografar o comprovante, permita o uso da câmera nas configurações do celular.');
    }
  }
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const resultado = origem === 'camera'
    ? await ImagePicker.launchCameraAsync(opcoes)
    : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (resultado.canceled || !resultado.assets?.[0]) return null;
  const original = resultado.assets[0];

  // Reduz para no máximo 1400 px de largura, em JPEG.
  let uri = original.uri;
  try {
    const contexto = ImageManipulator.manipulate(original.uri);
    if ((original.width ?? 0) > 1400) contexto.resize({ width: 1400 });
    const imagem = await contexto.renderAsync();
    const salvo = await imagem.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
    uri = salvo.uri;
  } catch {
    /* se não der para reduzir, usa a foto original */
  }

  if (Platform.OS === 'web') return uri;

  // A pasta temporária pode ser limpa pelo sistema: copia para a pasta de documentos do app.
  try {
    const pasta = new Directory(Paths.document, 'comprovantes-a-enviar');
    if (!pasta.exists) pasta.create({ intermediates: true });
    const destino = new File(pasta, Crypto.randomUUID() + '.jpg');
    await new File(uri).copy(destino);
    return destino.uri;
  } catch {
    return uri;
  }
}
