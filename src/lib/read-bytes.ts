import { File } from 'expo-file-system';

/** No celular: os bytes do arquivo escolhido (pelo endereço que o seletor devolve) */
export async function readPickedBytes(asset: { uri: string }): Promise<Uint8Array> {
  return new Uint8Array(await new File(asset.uri).arrayBuffer());
}
