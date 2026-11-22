// Material do projeto (ES4, D325): regras puras, iguais às do banco (project_files_fill e o bucket
// `materials`). O PDF vai para o Storage; o `.md` vira anotação da pasta (com as imagens que vierem
// junto, ES3); o resto fica de fora (o HTML chega no ES5).

import { isImageFile } from './note-images';

/** V13-4: 50 MB por arquivo de material (o 1 GB por conta é o mesmo dos anexos) */
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
export const MATERIAL_BUCKET = 'materials';
export const PDF_MIME = 'application/pdf';

export type MaterialKind = 'pdf' | 'markdown' | 'image' | 'other';

export function materialKindOf(name: string, mime?: string | null): MaterialKind {
  if (/\.pdf$/i.test(name) || mime === PDF_MIME) return 'pdf';
  if (/\.(md|markdown)$/i.test(name)) return 'markdown';
  if (isImageFile(name)) return 'image';
  return 'other';
}

/** "<pasta>/<id>.pdf": a RLS do Storage olha a primeira parte */
export function materialPath(folderId: string, id: string) {
  return `${folderId}/${id}.pdf`;
}

/** Na ordem do nome, com os números em ordem de número ("2 - " antes de "10 - ") */
export function sortMaterials<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }),
  );
}

export type PickedMaterial = { name: string; size?: number | null; mime?: string | null };

/** O que entra de uma escolha de arquivos: PDFs, `.md`, imagens (para os `.md`) e o que fica de fora */
export function planMaterials<T extends PickedMaterial>(files: readonly T[]) {
  const pdfs: T[] = [];
  const markdown: T[] = [];
  const images: T[] = [];
  const tooBig: T[] = [];
  const skipped: T[] = [];
  for (const file of files) {
    const kind = materialKindOf(file.name, file.mime);
    if (kind === 'other') skipped.push(file);
    else if (kind === 'pdf' && (file.size ?? 0) > MAX_MATERIAL_BYTES) tooBig.push(file);
    else (kind === 'pdf' ? pdfs : kind === 'markdown' ? markdown : images).push(file);
  }
  return { pdfs, markdown, images, tooBig, skipped };
}

/** Nome mostrado na lista: sem a extensão */
export function materialTitle(name: string) {
  return name.replace(/\.(pdf|md|markdown)$/i, '');
}
