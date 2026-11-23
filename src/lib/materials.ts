// Material do projeto (ES4, D325; ES5, D326): regras puras, iguais às do banco (project_files_fill
// e o bucket `materials`). O PDF vai para o Storage; o `.md` e o HTML com texto viram anotações da
// pasta (com as imagens que vierem junto, ES3); o HTML que é quase só script vai como arquivo; o
// `.zip` (a pasta do material) é aberto e cada arquivo segue a mesma regra.

import { isImageFile } from './note-images';

/** V13-4: 50 MB por arquivo de material (o 1 GB por conta é o mesmo dos anexos) */
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
export const MATERIAL_BUCKET = 'materials';
export const PDF_MIME = 'application/pdf';
/** O HTML interativo: na tabela é `text/html`; no Storage sobe como binário (nunca abre como página) */
export const HTML_MIME = 'text/html';
export const HTML_STORAGE_MIME = 'application/octet-stream';
/** O .zip inteiro é lido para a memória do aparelho */
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export type MaterialKind = 'pdf' | 'markdown' | 'html' | 'zip' | 'image' | 'other';

export function materialKindOf(name: string, mime?: string | null): MaterialKind {
  if (/\.pdf$/i.test(name) || mime === PDF_MIME) return 'pdf';
  if (/\.(md|markdown)$/i.test(name)) return 'markdown';
  if (/\.html?$/i.test(name)) return 'html';
  if (/\.zip$/i.test(name)) return 'zip';
  if (isImageFile(name)) return 'image';
  return 'other';
}

/** "<pasta>/<id>.pdf" (ou ".html"): a RLS do Storage olha a primeira parte */
export function materialPath(folderId: string, id: string, ext: 'pdf' | 'html' = 'pdf') {
  return `${folderId}/${id}.${ext}`;
}

/** Na ordem do nome, com os números em ordem de número ("2 - " antes de "10 - ") */
export function sortMaterials<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }),
  );
}

export type PickedMaterial = { name: string; size?: number | null; mime?: string | null };

/**
 * O que entra de uma escolha de arquivos: PDFs, `.md`, HTML, `.zip`, imagens (para os textos) e o
 * que fica de fora
 */
export function planMaterials<T extends PickedMaterial>(files: readonly T[]) {
  const pdfs: T[] = [];
  const markdown: T[] = [];
  const html: T[] = [];
  const zips: T[] = [];
  const images: T[] = [];
  const tooBig: T[] = [];
  const skipped: T[] = [];
  const lists = { pdf: pdfs, markdown, html, zip: zips, image: images };
  for (const file of files) {
    const kind = materialKindOf(file.name, file.mime);
    const max = kind === 'zip' ? MAX_ZIP_BYTES : MAX_MATERIAL_BYTES;
    if (kind === 'other') skipped.push(file);
    else if (kind !== 'image' && kind !== 'markdown' && (file.size ?? 0) > max) tooBig.push(file);
    else lists[kind].push(file);
  }
  return { pdfs, markdown, html, zips, images, tooBig, skipped };
}

/** Nome mostrado na lista: sem a extensão */
export function materialTitle(name: string) {
  return name.replace(/\.(pdf|md|markdown|html?)$/i, '');
}

// ---------- Plano de estudos inteiro (ES8, D330) ----------
// Espelho do código (D327) só para a prévia da importação: quem liga de verdade é o banco
// (`public.material_code`/`item_code`). Mudou a regra? Mude os dois, com os mesmos casos de teste.

const CODE = '([A-Za-zÀ-ÿ]{1,6} ?[0-9]{1,3}[A-Za-zÀ-ÿ]?)';
export function materialCode(name: string): string | null {
  return new RegExp(`^\\s*\\d+\\s*-\\s*${CODE}\\s+-\\s`).exec(name)?.[1]?.toLowerCase() ?? null;
}
export function itemCode(title: string): string | null {
  return new RegExp(`^\\s*${CODE}\\s+[·-]\\s`).exec(title)?.[1]?.toLowerCase() ?? null;
}

/** Quantos materiais ligam a um título (tarefa ou lista) pelo código, e quantos ficam sem */
export function matchMaterials(names: readonly string[], titles: readonly string[]) {
  const codes = new Set(titles.map(itemCode).filter((c): c is string => !!c));
  let linked = 0;
  for (const name of names) if (codes.has(materialCode(name) ?? '')) linked++;
  return { linked, unlinked: names.length - linked };
}

/** De vários projetos, o que casa com mais códigos do material (empate: o primeiro) */
export function bestProjectFor(names: readonly string[], projects: readonly (readonly string[])[]) {
  let best = 0;
  let bestScore = -1;
  projects.forEach((titles, i) => {
    const score = matchMaterials(names, titles).linked;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
