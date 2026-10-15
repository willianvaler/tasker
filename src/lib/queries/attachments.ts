import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  attachmentPaths,
  cleanName,
  extensionOf,
  isCompressibleImage,
  MAX_FILE_BYTES,
} from '@/lib/attachments';
import { base64ToBytes, bytesToBase64 } from '@/lib/base64';
import { tr } from '@/lib/i18n-ref';
import { prepareImage } from '@/lib/image-prep';
import { readFileBytes } from '@/lib/read-file';
import { uuidv7 } from '@/lib/uuid';
import { useSession } from '@/providers/session';
import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert } from '../sync/local';
import { keys } from './keys';

// Anexos da tarefa (N2/N3, D150–D152). O arquivo vai para o Storage (bucket privado) e a linha
// para `task_attachments` (pelo aparelho quando há sync). Baixar é por endereço assinado. Sem
// internet (com o banco no aparelho), o arquivo já reduzido espera em `pending_uploads` e sobe
// quando a conexão volta (`flushUploads`).

export type Attachment = Tables<'task_attachments'> & {
  /** Ainda no aparelho, esperando conexão */
  pending?: boolean;
  /** Miniatura local (data:) do que está na fila */
  preview?: string | null;
  /** Por que não subiu (sem permissão, tarefa apagada...) */
  error?: string | null;
};
const BUCKET = 'attachments';

type PendingRow = Omit<Tables<'task_attachments'>, 'created_by'> & {
  created_by: string | null;
  body: string;
  thumb_body: string | null;
  thumb_mime: string | null;
  error: string | null;
};

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.attachments(taskId ?? ''),
    enabled: !!taskId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Attachment[]> => {
      if (isLocal()) {
        const rows = await db.getAll<Attachment>(
          'select * from task_attachments where task_id = ? order by created_at',
          [taskId],
        );
        const pending = await db.getAll<PendingRow>(
          `select id, task_id, folder_id, path, thumb_path, name, mime, size, width, height,
                  created_by, created_at, error, thumb_body, thumb_mime, '' as body
           from pending_uploads where task_id = ? order by created_at`,
          [taskId],
        );
        return [
          ...rows.map((r) => ({ ...r, created_at: r.created_at.replace(' ', 'T') })),
          ...pending.map(({ body: _body, thumb_body, thumb_mime, ...r }) => ({
            ...r,
            pending: true,
            preview: thumb_body ? `data:${thumb_mime ?? 'image/webp'};base64,${thumb_body}` : null,
          })),
        ];
      }
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId ?? '')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Endereços assinados (1 h) para os caminhos; a tela guarda a imagem pelo caminho (cacheKey) */
export function useSignedUrls(paths: string[]) {
  const sorted = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ['attachment-urls', sorted],
    enabled: sorted.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(sorted, 3600);
      if (error) throw error;
      const urls: Record<string, string> = {};
      for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
      return urls;
    },
  });
}

export async function signedUrl(path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** O que o seletor devolve (câmera, galeria ou arquivo) */
export type PickedFile = {
  uri: string;
  name?: string | null;
  mime?: string | null;
  size?: number | null;
  width?: number;
  height?: number;
};

type Body = ArrayBuffer | Blob | Uint8Array;
type Prepared = {
  row: {
    id: string;
    task_id: string;
    path: string;
    thumb_path: string | null;
    name: string;
    mime: string;
    size: number;
    width: number | null;
    height: number | null;
  };
  body: Body;
  thumb: { body: Body; mime: string } | null;
};

const sizeOf = (body: Body) => (body instanceof Blob ? body.size : body.byteLength);
const toBytes = async (body: Body) =>
  body instanceof Uint8Array
    ? body
    : new Uint8Array(body instanceof Blob ? await body.arrayBuffer() : body);

async function prepare(file: PickedFile, task: { id: string; folder_id: string }) {
  const id = uuidv7();
  if (isCompressibleImage(file.mime)) {
    const { full, thumb } = await prepareImage(file.uri, file.width, file.height);
    const { path, thumbPath } = attachmentPaths(task.folder_id, task.id, id, full.ext);
    return {
      row: {
        id,
        task_id: task.id,
        path,
        thumb_path: thumbPath,
        name: cleanName(file.name, tr('attach.photo')),
        mime: full.mime,
        size: full.size,
        width: full.width,
        height: full.height,
      },
      body: full.body,
      thumb: { body: thumb.body, mime: thumb.mime },
    } satisfies Prepared;
  }
  const read = await readFileBytes(file.uri);
  const mime = file.mime || read.type || 'application/octet-stream';
  const { path } = attachmentPaths(task.folder_id, task.id, id, extensionOf(file.name ?? '', mime));
  return {
    row: {
      id,
      task_id: task.id,
      path,
      thumb_path: null,
      name: cleanName(file.name, tr('attach.file')),
      mime,
      size: sizeOf(read.body),
      width: null,
      height: null,
    },
    body: read.body,
    thumb: null,
  } satisfies Prepared;
}

async function upload(path: string, body: Body, contentType: string) {
  // upsert: subir de novo o que caiu no meio (fila) não falha por já existir
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
}

/** Envia o arquivo e grava a linha; sem a linha, apaga o arquivo para não ficar órfão */
async function send(p: Prepared, folderId: string, userId: string | null) {
  await upload(p.row.path, p.body, p.row.mime);
  if (p.thumb && p.row.thumb_path) await upload(p.row.thumb_path, p.thumb.body, p.thumb.mime);
  try {
    if (isLocal()) {
      await db.writeTransaction(async (tx) => {
        const exists = await tx.getOptional('select id from task_attachments where id = ?', [
          p.row.id,
        ]);
        if (!exists)
          await tx.execute(
            `insert into task_attachments (id, task_id, folder_id, path, thumb_path, name, mime,
               size, width, height, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.row.id,
              p.row.task_id,
              folderId,
              p.row.path,
              p.row.thumb_path,
              p.row.name,
              p.row.mime,
              p.row.size,
              p.row.width,
              p.row.height,
              userId,
              new Date().toISOString(),
            ],
          );
        await tx.execute('delete from pending_uploads where id = ?', [p.row.id]);
      });
    } else {
      const { error } = await supabase.from('task_attachments').insert(p.row);
      if (error) throw error;
    }
  } catch (err) {
    await supabase.storage
      .from(BUCKET)
      .remove(p.row.thumb_path ? [p.row.path, p.row.thumb_path] : [p.row.path]);
    throw err;
  }
}

async function enqueue(p: Prepared, folderId: string, userId: string | null) {
  await localInsert('pending_uploads', {
    ...p.row,
    folder_id: folderId,
    body: bytesToBase64(await toBytes(p.body)),
    thumb_body: p.thumb ? bytesToBase64(await toBytes(p.thumb.body)) : null,
    thumb_mime: p.thumb?.mime ?? null,
    created_by: userId,
    created_at: new Date().toISOString(),
    error: null,
  });
}

let flushing: Promise<void> | null = null;

/** Sobe o que ficou na fila de anexos (chamado quando a conexão volta e ao abrir o app) */
export function flushUploads(userId: string | null) {
  if (!isLocal() || !onlineManager.isOnline()) return Promise.resolve();
  flushing ??= (async () => {
    try {
      const rows = await db.getAll<PendingRow>(
        'select * from pending_uploads where error is null order by created_at',
      );
      for (const r of rows) {
        if (!onlineManager.isOnline()) break;
        const prepared: Prepared = {
          row: {
            id: r.id,
            task_id: r.task_id,
            path: r.path,
            thumb_path: r.thumb_path,
            name: r.name,
            mime: r.mime,
            size: r.size,
            width: r.width,
            height: r.height,
          },
          body: base64ToBytes(r.body),
          thumb:
            r.thumb_body && r.thumb_mime
              ? { body: base64ToBytes(r.thumb_body), mime: r.thumb_mime }
              : null,
        };
        try {
          await send(prepared, r.folder_id ?? '', r.created_by ?? userId);
        } catch (err) {
          // Erro de rede: tenta de novo depois. Recusa do servidor (permissão, tarefa apagada,
          // espaço cheio): fica marcado na tela, para a pessoa tirar
          if (!onlineManager.isOnline() || err instanceof TypeError) break;
          await db.execute('update pending_uploads set error = ? where id = ?', [
            (err as Error).message.slice(0, 200),
            r.id,
          ]);
        }
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

export function useAttachmentMutations(task: { id: string; folder_id: string | null }) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const key = keys.attachments(task.id);

  const add = useMutation({
    networkMode: 'always',
    mutationFn: async (file: PickedFile) => {
      const folderId = task.folder_id;
      if (!folderId) throw new Error(tr('attach.error'));
      const p = await prepare(file, { id: task.id, folder_id: folderId });
      if (p.row.size > MAX_FILE_BYTES) throw new Error(tr('attach.tooBig'));
      if (isLocal() && !onlineManager.isOnline()) return enqueue(p, folderId, userId);
      await send(p, folderId, userId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    networkMode: 'always',
    mutationFn: async (attachment: Attachment) => {
      if (attachment.pending) {
        await db.execute('delete from pending_uploads where id = ?', [attachment.id]);
        return;
      }
      if (!onlineManager.isOnline()) throw new Error(tr('attach.offline'));
      const paths = [attachment.path, attachment.thumb_path].filter((p): p is string => !!p);
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
      if (storageError) throw storageError;
      if (isLocal()) {
        await db.execute('delete from task_attachments where id = ?', [attachment.id]);
        return;
      }
      const { error } = await supabase.from('task_attachments').delete().eq('id', attachment.id);
      if (error) throw error;
    },
    onMutate: async (attachment) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Attachment[]>(key);
      queryClient.setQueryData<Attachment[]>(key, (list) =>
        (list ?? []).filter((a) => a.id !== attachment.id),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { add, remove };
}
