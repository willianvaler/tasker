import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  attachmentPaths,
  cleanName,
  extensionOf,
  isCompressibleImage,
  MAX_FILE_BYTES,
} from '@/lib/attachments';
import { tr } from '@/lib/i18n-ref';
import { prepareImage, type Prepared } from '@/lib/image-prep';
import { readFileBytes } from '@/lib/read-file';
import { uuidv7 } from '@/lib/uuid';
import { useSession } from '@/providers/session';
import type { Tables } from '../db';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert } from '../sync/local';
import { keys } from './keys';

// Anexos da tarefa (N2, D150). O arquivo vai para o Storage (bucket privado) e a linha para
// `task_attachments` (pelo aparelho quando há sync). Baixar é por endereço assinado e temporário.

export type Attachment = Tables<'task_attachments'>;
const BUCKET = 'attachments';

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.attachments(taskId ?? ''),
    enabled: !!taskId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async () => {
      if (isLocal()) {
        const rows = await db.getAll<Attachment>(
          'select * from task_attachments where task_id = ? order by created_at',
          [taskId],
        );
        return rows.map((r) => ({ ...r, created_at: r.created_at.replace(' ', 'T') }));
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

async function upload(path: string, body: ArrayBuffer | Blob, contentType: string) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
}

export function useAttachmentMutations(task: { id: string; folder_id: string | null }) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const key = keys.attachments(task.id);

  const add = useMutation({
    mutationFn: async (file: PickedFile) => {
      if (!task.folder_id) throw new Error(tr('attach.error'));
      const id = uuidv7();
      let full: Prepared | null = null;
      let thumb: Prepared | null = null;
      if (isCompressibleImage(file.mime)) {
        ({ full, thumb } = await prepareImage(file.uri, file.width, file.height));
      }
      let body: ArrayBuffer | Blob;
      let mime: string;
      let size: number;
      let ext: string;
      if (full) {
        ({ body, mime, size, ext } = full);
      } else {
        const read = await readFileBytes(file.uri);
        body = read.body;
        mime = file.mime || read.type || 'application/octet-stream';
        size = body instanceof ArrayBuffer ? body.byteLength : body.size;
        ext = extensionOf(file.name ?? '', mime);
      }
      if (size > MAX_FILE_BYTES) throw new Error(tr('attach.tooBig'));
      const { path, thumbPath } = attachmentPaths(task.folder_id, task.id, id, ext);
      await upload(path, body, mime);
      if (thumb) await upload(thumbPath, thumb.body, thumb.mime);
      const row = {
        id,
        task_id: task.id,
        path,
        thumb_path: thumb ? thumbPath : null,
        name: cleanName(file.name, tr('attach.photo')),
        mime,
        size,
        width: full?.width ?? null,
        height: full?.height ?? null,
      };
      try {
        if (isLocal()) {
          await localInsert('task_attachments', {
            ...row,
            folder_id: task.folder_id,
            created_by: session?.user.id ?? null,
            created_at: new Date().toISOString(),
          });
        } else {
          const { error } = await supabase.from('task_attachments').insert(row);
          if (error) throw error;
        }
      } catch (err) {
        // Sem a linha, o arquivo ficaria órfão no Storage
        await supabase.storage.from(BUCKET).remove(thumb ? [path, thumbPath] : [path]);
        throw err;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (attachment: Attachment) => {
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
