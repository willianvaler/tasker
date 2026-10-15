// Anexos de tarefa (N1/N2, D150): regras puras, iguais às do banco (task_attachments_fill e o
// bucket `attachments`). A compressão acontece no aparelho (lib/image-prep.ts).

/** Limites provisórios (V4-4): por arquivo e por conta */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ACCOUNT_BYTES = 1024 * 1024 * 1024;
/** Lado maior da imagem enviada e da miniatura */
export const FULL_SIDE = 2048;
export const THUMB_SIDE = 400;
export const FULL_QUALITY = 0.8;
export const THUMB_QUALITY = 0.7;

/** Imagens que o aparelho sabe reduzir (GIF animado e SVG vão como estão) */
export function isCompressibleImage(mime: string | null | undefined) {
  return !!mime && /^image\/(jpeg|jpg|png|webp|heic|heif|bmp)$/i.test(mime);
}

export function isImage(mime: string | null | undefined) {
  return !!mime && mime.toLowerCase().startsWith('image/');
}

/** Extensão segura para o caminho no Storage */
export function extensionOf(name: string, mime?: string | null): string {
  const fromName = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const fromMime = mime ? /\/([a-z0-9.+-]+)$/i.exec(mime)?.[1]?.toLowerCase() : undefined;
  return (fromMime ?? 'bin').replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
}

/** "<pasta>/<tarefa>/<id>.<ext>" e a miniatura "<pasta>/<tarefa>/<id>.thumb.webp" */
export function attachmentPaths(folderId: string, taskId: string, id: string, ext: string) {
  const base = `${folderId}/${taskId}/${id}`;
  return { path: `${base}.${ext}`, thumbPath: `${base}.thumb.webp` };
}

/** Tamanho que cabe num quadrado de `side` sem aumentar a imagem */
export function fitWithin(width: number, height: number, side: number) {
  if (width <= 0 || height <= 0) return null;
  const scale = Math.min(1, side / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** "820 KB", "3,4 MB" no idioma */
export function formatBytes(bytes: number, locale = 'pt-BR') {
  const n = (v: number, digits: number) =>
    v.toLocaleString(locale, { maximumFractionDigits: digits });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${n(bytes / 1024, 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${n(bytes / (1024 * 1024), 1)} MB`;
  return `${n(bytes / (1024 * 1024 * 1024), 2)} GB`;
}

/** Nome do arquivo sem caminho, limitado ao que o banco aceita */
export function cleanName(name: string | null | undefined, fallback: string) {
  const base = (name ?? '').split(/[\\/]/).pop()?.trim() ?? '';
  return (base || fallback).slice(0, 200);
}
