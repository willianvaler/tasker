import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isCompressibleImage, MAX_FILE_BYTES } from '../attachments';
import type { ExamResult } from '../exams';
import { tr } from '../i18n-ref';
import { prepareImage } from '../image-prep';
import { readFileBytes } from '../read-file';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, sessionUserId } from '../sync/local';

/**
 * Exames (SA4, D389): dado de saúde, só com o consentimento `health`. Lê e grava no aparelho
 * depois da primeira sincronização (registro, edição e gráfico sem internet). O anexo vai para o
 * bucket privado `health` e pede conexão.
 */
const KEY = ['exams'] as const;
const BUCKET = 'health';
const COLS = 'id, day, name, value, unit, ref_low, ref_high, note, file_path, file_mime';

export type ExamInput = Omit<ExamResult, 'file_path' | 'file_mime'>;

export function useExams() {
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<ExamResult[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      if (isLocal()) {
        return db.getAll<ExamResult>(
          `select ${COLS} from exam_results where user_id = ? order by name, day`,
          [userId],
        );
      }
      const { data, error } = await supabase
        .from('exam_results')
        .select(COLS)
        .eq('user_id', userId)
        .order('name')
        .order('day');
      if (error) throw error;
      return (data ?? []).map((x) => ({
        ...x,
        value: Number(x.value),
        ref_low: x.ref_low == null ? null : Number(x.ref_low),
        ref_high: x.ref_high == null ? null : Number(x.ref_high),
      })) as ExamResult[];
    },
  });
}

/** Grava a linha no aparelho (ou no servidor antes da primeira sincronização). */
async function writeRow(id: string, values: Partial<ExamResult>, insert: boolean) {
  if (isLocal()) {
    const keys = Object.keys(values) as (keyof ExamResult)[];
    if (insert) {
      await db.execute(
        `insert into exam_results (id, user_id, created_at, ${keys.join(', ')})
         values (?, ?, ?, ${keys.map(() => '?').join(', ')})`,
        [id, await sessionUserId(), new Date().toISOString(), ...keys.map((k) => values[k])],
      );
    } else {
      await db.execute(
        `update exam_results set ${keys.map((k) => `${k} = ?`).join(', ')} where id = ?`,
        [...keys.map((k) => values[k]), id],
      );
    }
    return;
  }
  const { error } = insert
    ? await supabase.from('exam_results').insert({ id, ...values } as never)
    : await supabase
        .from('exam_results')
        .update(values as never)
        .eq('id', id);
  if (error) throw error;
}

export function useExamActions() {
  const queryClient = useQueryClient();
  const patch = (update: (list: ExamResult[]) => ExamResult[]) =>
    queryClient.setQueryData<ExamResult[]>(KEY, (d) => (d ? update(d) : d));
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });

  const save = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async ({ exam, isNew }: { exam: ExamInput; isNew: boolean }) => {
      const { id, ...values } = exam;
      await writeRow(id, values, isNew);
    },
    onMutate: async ({ exam, isNew }) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      patch((list) =>
        isNew
          ? [...list, { ...exam, file_path: null, file_mime: null }]
          : list.map((x) => (x.id === exam.id ? { ...x, ...exam } : x)),
      );
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from exam_results where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('exam_results').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((list) => list.filter((x) => x.id !== id)),
    onSettled: settle,
  });

  /** Envia a foto (reduzida) ou o PDF e liga ao resultado; o arquivo antigo vai para a limpeza. */
  const attach = useMutation({
    mutationFn: async ({
      id,
      file,
    }: {
      id: string;
      file: { uri: string; mime?: string | null; width?: number; height?: number };
    }) => {
      const userId = await sessionUserId();
      if (!userId) return;
      let body: ArrayBuffer | Blob;
      let mime: string;
      let ext: string;
      if (isCompressibleImage(file.mime)) {
        const { full } = await prepareImage(file.uri, file.width, file.height);
        ({ body, mime, ext } = full);
      } else if (file.mime === 'application/pdf') {
        body = (await readFileBytes(file.uri)).body;
        mime = 'application/pdf';
        ext = 'pdf';
      } else {
        throw new Error(tr('exams.fileType'));
      }
      const size = body instanceof Blob ? body.size : body.byteLength;
      if (size > MAX_FILE_BYTES) throw new Error(tr('exams.fileTooBig'));
      const path = `${userId}/${id}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, body, { contentType: mime, upsert: true });
      if (error) throw error;
      await writeRow(id, { file_path: path, file_mime: mime }, false);
    },
    onSettled: settle,
  });

  const detach = useMutation({
    networkMode: isLocal() ? 'always' : 'online',
    mutationFn: (id: string) => writeRow(id, { file_path: null, file_mime: null }, false),
    onMutate: (id) =>
      patch((list) =>
        list.map((x) => (x.id === id ? { ...x, file_path: null, file_mime: null } : x)),
      ),
    onSettled: settle,
  });

  return { save, remove, attach, detach };
}

/** Endereço temporário (5 min) do anexo, só para a dona. */
export async function examFileUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
