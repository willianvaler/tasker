import { File } from 'expo-file-system';

/** Conteúdo de um arquivo local (câmera, galeria, seletor), para enviar ao Storage */
export async function readFileBytes(uri: string): Promise<{ body: ArrayBuffer | Blob; type: string }> {
  return { body: await new File(uri).arrayBuffer(), type: '' };
}
