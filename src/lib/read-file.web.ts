/** Na web, o seletor e o manipulador devolvem endereços blob:/data: */
export async function readFileBytes(uri: string): Promise<{ body: ArrayBuffer | Blob; type: string }> {
  const blob = await (await fetch(uri)).blob();
  return { body: blob, type: blob.type };
}
