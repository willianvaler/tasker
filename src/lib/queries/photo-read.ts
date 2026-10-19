import { FunctionsHttpError } from '@supabase/supabase-js';

import { prepareForReading, type Prepared } from '../image-prep';
import { toBase64 } from '../photo-read';
import { supabase } from '../supabase';
import { uuidv7 } from '../uuid';

// Leitura de foto pela Edge Function `read-photo` (ESCOPO_V9, GA4/GA5/GA6) e a foto da nota no
// Storage (bucket `receipts`, "<pasta>/<lançamento>/<arquivo>").

export type PhotoKind = 'receipt' | 'list';
/** not_configured: sem chave no servidor; limit: acabaram as leituras do mês; busy: cota do
 *  Gemini no minuto/dia; offline: sem conexão; failed: o resto */
export type PhotoReadFailure = 'not_configured' | 'limit' | 'busy' | 'offline' | 'failed';

export class PhotoReadError extends Error {
  constructor(
    public code: PhotoReadFailure,
    public limit?: number,
  ) {
    super(code);
  }
}

const toBytes = async (body: ArrayBuffer | Blob) =>
  new Uint8Array(body instanceof Blob ? await body.arrayBuffer() : body);

export async function preparePhoto(uri: string, width?: number, height?: number) {
  return prepareForReading(uri, width, height);
}

/** Manda a foto e devolve a leitura crua (quem chama normaliza) e quantas sobram no mês. */
export async function readPhoto(photo: Prepared, kind: PhotoKind, language: string) {
  const image = toBase64(await toBytes(photo.body));
  const { data, error } = await supabase.functions.invoke('read-photo', {
    body: { image, mime: photo.mime, kind, language },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => ({}))) as {
        error?: string;
        limit?: number;
      };
      const code = (['not_configured', 'limit', 'busy'] as const).find((c) => c === body.error);
      throw new PhotoReadError(code ?? 'failed', body.limit);
    }
    throw new PhotoReadError('offline');
  }
  return data as { result: unknown; left: number };
}

/** Guarda a foto da nota do lançamento; devolve o caminho para `receipt_path`. */
export async function uploadReceipt(folderId: string, expenseId: string, photo: Prepared) {
  const path = `${folderId}/${expenseId}/${uuidv7()}.${photo.ext}`;
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.storage
      .from('receipts')
      .upload(path, photo.body, { contentType: photo.mime, upsert: true });
    if (!error) return path;
    // O lançamento acabou de nascer no aparelho e ainda está chegando ao servidor
    if (attempt < 4 && /row-level security|not found/i.test(error.message)) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      continue;
    }
    throw error;
  }
}

export async function receiptUrl(path: string) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
