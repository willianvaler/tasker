/** Na web: o seletor já devolve o File do navegador; sem ele, lê pelo endereço (blob:) */
export async function readPickedBytes(asset: { uri: string; file?: File }): Promise<Uint8Array> {
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  return new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
}
