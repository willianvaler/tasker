import { tr } from '@/lib/i18n-ref';

// No celular não há como desenhar o SVG para PNG sem uma biblioteca nativa: fica para a web
export async function rasterizeSvg(_body: ArrayBuffer | Blob | Uint8Array): Promise<Blob> {
  throw new Error(tr('noteImages.svgWebOnly'));
}
