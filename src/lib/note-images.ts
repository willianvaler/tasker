// Imagens nas anotações (ES3, ESCOPO_V13 §2, D324). A anotação aponta para a imagem com
// `![texto](qlimg:<anotação>/<id>.<ext>)`: a referência já é o caminho no Storage (sem o
// "notes/"), então mostrar não consulta a tabela. Puro, com teste.

/** Esquema da imagem da anotação (só letras: o leitor de Markdown não mexe) */
export const IMAGE_SCHEME = 'qlimg:';

/** Tipos de imagem aceitos (os que o app desenha no celular e na web) */
export const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export const isImageFile = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name);

/** `<anotação>/<id>.<ext>` */
export const imageRef = (noteId: string, assetId: string, ext: string) =>
  `${noteId}/${assetId}.${ext.toLowerCase()}`;

/** Caminho no Storage (bucket dos anexos) */
export const imagePath = (ref: string) => `notes/${ref}`;

/** Markdown da imagem (colchetes do texto saem, para não quebrar o link) */
export const imageMarkdown = (alt: string, ref: string) =>
  `![${alt.replace(/[[\]]/g, '').trim()}](${IMAGE_SCHEME}${ref})`;

/** A referência de um `qlimg:`; null se não é imagem da anotação ou se o formato não bate */
export function parseImageRef(uri: string): string | null {
  if (!uri.startsWith(IMAGE_SCHEME)) return null;
  const ref = uri.slice(IMAGE_SCHEME.length);
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(ref) ? ref : null;
}

/** As referências das imagens citadas no texto (sem repetir) */
export function noteImageRefs(body: string): string[] {
  const refs = new Set<string>();
  for (const m of body.matchAll(/!\[[^\]]*\]\(qlimg:([^)\s]+)\)/g)) {
    const ref = parseImageRef(`${IMAGE_SCHEME}${m[1]}`);
    if (ref) refs.add(ref);
  }
  return [...refs];
}
