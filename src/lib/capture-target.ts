// Destino da captura (Alt+N → T, N, paleta): a tela de onde ela foi aberta, nunca a última
// página visitada. Na página aberta, ela; na pasta aberta, a última página usada se for dessa
// pasta, senão a primeira; fora de pasta (Início, Hoje...), a Caixa de entrada.

type PageLike = { id: string; folder_id: string };

export type CaptureContext = { page?: string; folder?: string };

/** Contexto da rota atual para abrir a captura (`/page/:id` ou `/folder/:id`). */
export function captureContext(pathname: string | null | undefined): CaptureContext {
  const match = /^\/(folder|page)\/([^/?]+)/.exec(pathname ?? '');
  if (!match) return {};
  return match[1] === 'page' ? { page: match[2] } : { folder: match[2] };
}

/** Página de destino; `undefined` quando o contexto não tem página (fica a Caixa de entrada). */
export function captureTargetId(
  context: CaptureContext,
  pages: readonly PageLike[],
  folderIds: (folderId: string) => readonly string[],
  lastPageId: string | null,
): string | undefined {
  if (context.page && pages.some((p) => p.id === context.page)) return context.page;
  if (!context.folder) return undefined;
  const inFolder = new Set(folderIds(context.folder));
  const candidates = pages.filter((p) => inFolder.has(p.folder_id));
  return (candidates.find((p) => p.id === lastPageId) ?? candidates[0])?.id;
}

type FolderLike = { id: string; children: readonly { id: string }[] };

/** A pasta e as subpastas dela (ou só a subpasta, se for uma). */
export function folderScope(folders: readonly FolderLike[] | undefined, id: string): string[] {
  for (const f of folders ?? []) {
    if (f.id === id) return [f.id, ...f.children.map((c) => c.id)];
    if (f.children.some((c) => c.id === id)) return [id];
  }
  return [id];
}
