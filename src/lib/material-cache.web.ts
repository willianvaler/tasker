import { materialUrl } from '@/lib/queries/materials';

// Material no navegador (ES7, D328): o Cache Storage guarda o arquivo pelo caminho (o endereço
// assinado muda a cada hora; a chave não). Sem Cache Storage (aba anônima em alguns navegadores),
// baixa toda vez.

const CACHE = 'questlist-materials';
const keyFor = (path: string) => `/material-cache/${encodeURI(path)}`;

async function open() {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE);
  } catch {
    return null;
  }
}

export async function isMaterialCached(path: string) {
  const cache = await open();
  return !!(cache && (await cache.match(keyFor(path))));
}

/** O arquivo: do cache ou baixado agora (e guardado) */
export async function getMaterialBlob(path: string): Promise<Blob> {
  const cache = await open();
  const hit = cache ? await cache.match(keyFor(path)) : undefined;
  if (hit) return hit.blob();
  const res = await fetch(await materialUrl(path));
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  await cache?.put(keyFor(path), new Response(blob)).catch(() => {});
  return blob;
}

export async function saveMaterialOffline(path: string) {
  await getMaterialBlob(path);
}

/** Só no celular */
export async function localMaterialFile(_path: string): Promise<never> {
  throw new Error('native only');
}
