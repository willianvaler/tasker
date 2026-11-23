import { Directory, File, Paths } from 'expo-file-system';

import { materialUrl } from '@/lib/queries/materials';

// Material no aparelho (ES7, D328): o PDF e o HTML baixam ao abrir e ficam no cache (até o sistema
// precisar de espaço); "Baixar para ler sem internet" baixa todos de uma vez. No celular, um arquivo
// na pasta de cache; na web, o Cache Storage do navegador (material-cache.web.ts).

const dir = () => new Directory(Paths.cache, 'materials');
const fileFor = (path: string) => new File(dir(), path.replace(/\//g, '_'));

export async function isMaterialCached(path: string) {
  const file = fileFor(path);
  return file.exists && (file.size ?? 0) > 0;
}

/** O arquivo no aparelho (baixa na primeira vez) */
export async function localMaterialFile(path: string): Promise<File> {
  const d = dir();
  if (!d.exists) d.create({ idempotent: true });
  const file = fileFor(path);
  if (file.exists && (file.size ?? 0) > 0) return file;
  return File.downloadFileAsync(await materialUrl(path), file, { idempotent: true });
}

export async function saveMaterialOffline(path: string) {
  await localMaterialFile(path);
}

/** Só na web */
export async function getMaterialBlob(_path: string): Promise<Blob> {
  throw new Error('web only');
}
