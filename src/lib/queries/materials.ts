import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MAX_ACCOUNT_BYTES } from '@/lib/attachments';
import { tr } from '@/lib/i18n-ref';
import {
  HTML_MIME,
  HTML_STORAGE_MIME,
  MATERIAL_BUCKET,
  materialPath,
  MAX_MATERIAL_BYTES,
  PDF_MIME,
  sortMaterials,
} from '@/lib/materials';
import { uuidv7 } from '@/lib/uuid';
import type { MaterialLinkRow } from '@/lib/material-links';
import type { Tables } from '../db';
import { supabase } from '../supabase';

// Material do projeto (ES4, D325): a lista vem do servidor (fica no cache do aparelho para ver sem
// internet); acrescentar e tirar pedem conexão, como os anexos. O PDF vai para o bucket
// `materials`; o `.md` já virou anotação da pasta e aqui só ganha a linha da lista.

export type Material = Tables<'project_files'>;

const key = (folderId: string) => ['materials', folderId] as const;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useMaterials(folderId: string | undefined) {
  return useQuery({
    queryKey: key(folderId ?? ''),
    enabled: !!folderId,
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('folder_id', folderId ?? '');
      if (error) throw error;
      return sortMaterials(data);
    },
  });
}

export function useMaterial(id: string | undefined) {
  return useQuery({
    queryKey: ['material', id ?? ''],
    enabled: !!id,
    queryFn: async (): Promise<Material | null> => {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('id', id ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Mensagem do servidor → texto no idioma do app */
function friendly(message: string): Error {
  if (/Espaço de anexos cheio/.test(message)) return new Error(tr('attach.full'));
  if (/maximum allowed size|Payload too large|exceeded the maximum/i.test(message))
    return new Error(tr('materials.tooBig'));
  return new Error(message);
}

/**
 * Envia um PDF ou um HTML interativo e grava a linha; sem a linha, apaga o arquivo para não ficar
 * órfão. O HTML sobe como binário (o endereço do Storage nunca o abre como página)
 */
export async function sendMaterialFile(
  folderId: string,
  file: { name: string; body: Uint8Array | Blob; kind: 'pdf' | 'html' },
) {
  const size = file.body instanceof Blob ? file.body.size : file.body.byteLength;
  if (size > MAX_MATERIAL_BYTES) throw new Error(tr('materials.tooBig'));
  const { data: used } = await supabase.rpc('attachment_usage');
  if (Number(used ?? 0) + size > MAX_ACCOUNT_BYTES) throw new Error(tr('attach.full'));
  const id = uuidv7();
  const path = materialPath(folderId, id, file.kind);
  const up = await supabase.storage.from(MATERIAL_BUCKET).upload(path, file.body, {
    contentType: file.kind === 'pdf' ? PDF_MIME : HTML_STORAGE_MIME,
    upsert: true,
    cacheControl: '31536000',
  });
  if (up.error) throw friendly(up.error.message);
  const { error } = await supabase.from('project_files').insert({
    id,
    folder_id: folderId,
    kind: 'file',
    path,
    name: file.name.slice(0, 200),
    mime: file.kind === 'pdf' ? PDF_MIME : HTML_MIME,
    size,
  });
  if (error) {
    await supabase.storage.from(MATERIAL_BUCKET).remove([path]);
    throw friendly(error.message);
  }
}

/** As anotações que entraram como material ganham a linha da lista (já estão no servidor) */
export async function addNoteMaterials(
  folderId: string,
  notes: readonly { noteId: string; name: string }[],
) {
  if (!notes.length) return;
  const rows = notes.map((n) => ({
    id: uuidv7(),
    folder_id: folderId,
    kind: 'note',
    note_id: n.noteId,
    name: n.name.slice(0, 200),
  }));
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.from('project_files').insert(rows);
    if (!error) return;
    // A anotação acabou de subir pelo sync: a trava do banco pode não a ver ainda
    if (attempt < 4 && /não é desta pasta/.test(error.message)) {
      await wait(1500);
      continue;
    }
    throw friendly(error.message);
  }
}

export function useMaterialMutations(folderId: string) {
  const queryClient = useQueryClient();
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: key(folderId) });
    queryClient.invalidateQueries({ queryKey: ['attachment-usage'] });
    queryClient.invalidateQueries({ queryKey: ['storage-usage'] });
    queryClient.invalidateQueries({ queryKey: ['material-links'] });
    queryClient.invalidateQueries({ queryKey: ['project-materials'] });
  };
  /** Tirar da lista: vai para a lixeira (a anotação, se for uma, continua nas Anotações) */
  const remove = useMutation({
    mutationFn: async (material: Material) => {
      const { error } = await supabase.from('project_files').delete().eq('id', material.id);
      if (error) throw error;
    },
    onMutate: (material) => {
      const previous = queryClient.getQueryData<Material[]>(key(folderId));
      queryClient.setQueryData<Material[]>(key(folderId), (list) =>
        list?.filter((m) => m.id !== material.id),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => queryClient.setQueryData(key(folderId), context?.previous),
    onSettled: settle,
  });
  return { remove, settle };
}

/** Endereço assinado (1 h) do arquivo do material */
export async function materialUrl(path: string) {
  const { data, error } = await supabase.storage.from(MATERIAL_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Uso do espaço por tipo (V13-4: a tela de Dados mostra separado) */
export type StorageUsage = {
  attachments: number;
  note_versions: number;
  note_images: number;
  materials: number;
};
export function useStorageUsage() {
  return useQuery({
    queryKey: ['storage-usage'],
    queryFn: async (): Promise<StorageUsage> => {
      const { data, error } = await supabase.rpc('storage_usage');
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      return {
        attachments: Number(r.attachments ?? 0),
        note_versions: Number(r.note_versions ?? 0),
        note_images: Number(r.note_images ?? 0),
        materials: Number(r.materials ?? 0),
      };
    },
  });
}

// ---------- Ligar o material às tarefas (ES6, D327) ----------

/** As ligações do material do projeto de `folderId` (pelo código e à mão); sem pasta, todas */
export function useMaterialLinks(folderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['material-links', folderId ?? 'all'],
    enabled,
    queryFn: async (): Promise<MaterialLinkRow[]> => {
      const { data, error } = await supabase.rpc(
        'material_task_links',
        folderId ? { p_folder: folderId } : {},
      );
      if (error) throw error;
      return data;
    },
  });
}

/** Todo o material do projeto (a raiz e as subpastas), na ordem do nome */
export function useProjectMaterials(folderIds: readonly string[]) {
  const ids = [...folderIds].sort();
  return useQuery({
    queryKey: ['project-materials', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase.from('project_files').select('*').in('folder_id', ids);
      if (error) throw error;
      return sortMaterials(data);
    },
  });
}

export function useMaterialLinkMutations() {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: ['material-links'] });
  const link = useMutation({
    mutationFn: async ({ materialId, taskId }: { materialId: string; taskId: string }) => {
      const { error } = await supabase
        .from('material_links')
        .upsert(
          { material_id: materialId, task_id: taskId, linked: true },
          { onConflict: 'material_id,task_id' },
        );
      if (error) throw error;
    },
    onSettled: settle,
  });
  /** A automática (pelo código) fica marcada como desfeita; a feita à mão sai */
  const unlink = useMutation({
    mutationFn: async ({ material, taskId }: { material: MaterialLinkRow; taskId: string }) => {
      const { error } = material.auto
        ? await supabase
            .from('material_links')
            .upsert(
              { material_id: material.material_id, task_id: taskId, linked: false },
              { onConflict: 'material_id,task_id' },
            )
        : await supabase
            .from('material_links')
            .delete()
            .eq('material_id', material.material_id)
            .eq('task_id', taskId);
      if (error) throw error;
    },
    onSettled: settle,
  });
  return { link, unlink };
}

// ---------- Onde parei (ES7, D328) ----------

export type ReadingPosition = { scroll?: number; page?: number };

/** A posição de leitura da pessoa neste material (fica no cache para abrir sem internet) */
export function useReadingPosition(materialId: string | undefined) {
  return useQuery({
    queryKey: ['reading-position', materialId ?? ''],
    enabled: !!materialId,
    queryFn: async (): Promise<ReadingPosition | null> => {
      const { data, error } = await supabase
        .from('reading_positions')
        .select('position')
        .eq('material_id', materialId ?? '')
        .maybeSingle();
      if (error) throw error;
      return (data?.position as ReadingPosition | undefined) ?? null;
    },
  });
}

export function useSaveReadingPosition(materialId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (position: ReadingPosition) => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      const { error } = await supabase
        .from('reading_positions')
        .upsert(
          {
            user_id: userId,
            material_id: materialId,
            position,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,material_id' },
        );
      if (error) throw error;
    },
    onMutate: (position) => queryClient.setQueryData(['reading-position', materialId], position),
  });
}
