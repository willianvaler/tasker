import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { FULL_QUALITY, FULL_SIDE, fitWithin, THUMB_QUALITY, THUMB_SIDE } from '@/lib/attachments';
import { readFileBytes } from '@/lib/read-file';

// Compressão no aparelho antes de enviar (D150): a imagem grande vai com o lado maior até 2048 px
// em WebP ~0,8, e a miniatura com 400 px, para as listas. Navegador que não gera WebP (o canvas
// devolve PNG) cai para JPEG.

export type Prepared = {
  body: ArrayBuffer | Blob;
  mime: string;
  ext: string;
  size: number;
  width: number;
  height: number;
};

async function render(uri: string, width: number, height: number, side: number, quality: number) {
  const target = fitWithin(width, height, side);
  for (const format of [SaveFormat.WEBP, SaveFormat.JPEG]) {
    const context = ImageManipulator.manipulate(uri);
    if (target && (target.width < width || target.height < height)) context.resize(target);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format, compress: quality });
    const { body, type } = await readFileBytes(saved.uri);
    const mime = format === SaveFormat.WEBP ? 'image/webp' : 'image/jpeg';
    // O canvas da web ignora o formato que não sabe gerar: tenta de novo em JPEG
    if (type && type !== mime) continue;
    const size = body instanceof ArrayBuffer ? body.byteLength : body.size;
    return {
      body,
      mime,
      ext: format === SaveFormat.WEBP ? 'webp' : 'jpg',
      size,
      width: saved.width,
      height: saved.height,
    } satisfies Prepared;
  }
  throw new Error('image');
}

/** Imagem reduzida e miniatura. `width`/`height` 0 = desconhecidos (lê do arquivo). */
export async function prepareImage(uri: string, width = 0, height = 0) {
  if (!width || !height) {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    width = original.width;
    height = original.height;
  }
  const full = await render(uri, width, height, FULL_SIDE, FULL_QUALITY);
  const thumb = await render(uri, width, height, THUMB_SIDE, THUMB_QUALITY);
  return { full, thumb };
}

/**
 * Foto para ler (nota ou lista, V9): lado maior até 1600 px, o bastante para o texto miúdo de um
 * cupom e leve para enviar. É também a que fica guardada como foto da nota.
 */
export async function prepareForReading(uri: string, width = 0, height = 0) {
  if (!width || !height) {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    width = original.width;
    height = original.height;
  }
  return render(uri, width, height, 1600, 0.75);
}
