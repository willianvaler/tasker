import { tr } from '@/lib/i18n-ref';
import { prepareImage } from '@/lib/image-prep';
import { rasterizeSvg } from '@/lib/svg-raster';
import { imageMarkdown, imagePath, imageRef } from '@/lib/note-images';
import { supabase } from '@/lib/supabase';
import { uuidv7 } from '@/lib/uuid';
import { cleanName } from '@/lib/attachments';

import { useSignedUrls } from './attachments';

// Imagens nas anotações (ES3, D324): o arquivo vai para o bucket dos anexos em
// "notes/<anotação>/<id>.<ext>" e a linha para `note_assets` (cota, permissão, lixeira). Pede
// conexão, como os anexos. A anotação recém-criada pode ainda estar chegando ao servidor (sync): o
// Storage e a tabela só a enxergam um pouco depois, então tenta de novo algumas vezes.

const BUCKET = 'attachments';
type Body = ArrayBuffer | Blob | Uint8Array;

const sizeOf = (body: Body) => (body instanceof Blob ? body.size : body.byteLength);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const notYet = (message: string) => /row-level security|violates|not found|42501/i.test(message);

async function retrying(run: () => Promise<{ error: { message: string } | null }>) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await run();
    if (!error) return;
    if (attempt < 6 && notYet(error.message)) {
      await wait(1500);
      continue;
    }
    if (/maximum allowed size|Payload too large|exceeded the maximum/i.test(error.message))
      throw new Error(tr('attach.tooBig'));
    throw new Error(error.message);
  }
}

/** Envia a imagem e grava a linha; devolve o Markdown para pôr na anotação. */
export async function sendNoteImage(input: {
  noteId: string;
  body: Body;
  mime: string;
  ext: string;
  name: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
  /** Id já escolhido (o do cofre, que a anotação já cita) */
  id?: string;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  // SVG: sobe desenhado em PNG (no mesmo caminho que o texto já cita)
  if (input.mime === 'image/svg+xml')
    input = { ...input, body: await rasterizeSvg(input.body), mime: 'image/png' };
  const ref = imageRef(input.noteId, id, input.ext);
  const path = imagePath(ref);
  await retrying(async () =>
    supabase.storage.from(BUCKET).upload(path, input.body, {
      contentType: input.mime,
      upsert: true,
      cacheControl: '31536000',
    }),
  );
  try {
    await retrying(async () =>
      supabase.from('note_assets').insert({
        id,
        note_id: input.noteId,
        path,
        name: input.name.slice(0, 200),
        mime: input.mime,
        size: sizeOf(input.body),
        width: input.width ?? null,
        height: input.height ?? null,
      }),
    );
  } catch (err) {
    // Sem a linha, o arquivo não conta na cota nem some com a anotação: apaga
    await supabase.storage.from(BUCKET).remove([path]);
    throw err;
  }
  return imageMarkdown(input.alt ?? input.name.replace(/\.[^.]+$/, ''), ref);
}

/** Foto ou imagem escolhida no aparelho: reduzida como a da tarefa (lado maior 2048 px, WebP) */
export async function sendPickedNoteImage(
  noteId: string,
  file: { uri: string; name?: string | null; width?: number; height?: number },
) {
  const { full } = await prepareImage(file.uri, file.width, file.height);
  const name = cleanName(file.name, tr('attach.photo'));
  return sendNoteImage({
    noteId,
    body: full.body,
    mime: full.mime,
    ext: full.ext,
    name: name.replace(/\.[^.]+$/, '') + `.${full.ext}`,
    alt: name.replace(/\.[^.]+$/, ''),
    width: full.width,
    height: full.height,
  });
}

/** Espera as anotações recém-criadas existirem no servidor (o sync manda em seguida) */
export async function waitForNotesOnServer(ids: readonly string[], timeoutMs = 90_000) {
  const missing = new Set(ids);
  const started = Date.now();
  while (missing.size && Date.now() - started < timeoutMs) {
    const chunk = [...missing].slice(0, 200);
    const { data } = await supabase.from('notes').select('id').in('id', chunk);
    for (const row of data ?? []) missing.delete(row.id);
    if (missing.size) await wait(1500);
  }
  return missing.size === 0;
}

/** Endereço assinado (1 h) da imagem da anotação */
export function useNoteImageUrl(ref: string) {
  const urls = useSignedUrls([imagePath(ref)]);
  return { url: urls.data?.[imagePath(ref)], error: urls.error, pending: urls.isPending };
}
