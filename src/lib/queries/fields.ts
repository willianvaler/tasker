import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Json, Tables } from '../db';
import type { FieldKind } from '../fields';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate } from '../sync/local';
import { uuidv7 } from '../uuid';

// Campos personalizados da página (M5, D142). Lê do aparelho quando dá; escrita direta (RLS).

export type PageField = Omit<Tables<'page_fields'>, 'options' | 'kind'> & {
  kind: FieldKind;
  options: string[];
};
const fieldsKey = (pageId: string) => ['page-fields', pageId] as const;

const parse = (row: Record<string, unknown>): PageField => ({
  ...(row as PageField),
  options:
    typeof row.options === 'string'
      ? JSON.parse(row.options)
      : Array.isArray(row.options)
        ? (row.options as string[])
        : [],
});

export function usePageFields(pageId: string | undefined) {
  return useQuery({
    queryKey: fieldsKey(pageId ?? ''),
    enabled: !!pageId,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<PageField[]> => {
      if (isLocal())
        return (
          await db.getAll<Record<string, unknown>>(
            'select * from page_fields where page_id = ? order by position, created_at',
            [pageId],
          )
        ).map(parse);
      const { data, error } = await supabase
        .from('page_fields')
        .select('*')
        .eq('page_id', pageId ?? '')
        .order('position')
        .order('created_at');
      if (error) throw error;
      return data.map((r) => parse(r as Record<string, unknown>));
    },
  });
}

export function useFieldMutations(pageId: string) {
  const queryClient = useQueryClient();
  const settle = () => queryClient.invalidateQueries({ queryKey: fieldsKey(pageId) });
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const list = () => queryClient.getQueryData<PageField[]>(fieldsKey(pageId)) ?? [];

  const add = useMutation({
    networkMode,
    mutationFn: async ({
      name,
      kind,
      options,
    }: {
      name: string;
      kind: FieldKind;
      options: string[];
    }) => {
      const row = {
        id: uuidv7(),
        page_id: pageId,
        name,
        kind,
        options: options as NonNullable<Json>,
        position: list().length,
      };
      if (isLocal()) {
        const folder = await db.getOptional<{ folder_id: string }>(
          'select folder_id from pages where id = ?',
          [pageId],
        );
        await localInsert('page_fields', {
          ...row,
          folder_id: folder?.folder_id ?? null,
          created_at: new Date().toISOString(),
        });
        return;
      }
      const { error } = await supabase.from('page_fields').insert(row);
      if (error) throw error;
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({
      id,
      name,
      options,
    }: {
      id: string;
      name?: string;
      options?: string[];
    }) => {
      const patch = {
        ...(name !== undefined ? { name } : {}),
        ...(options !== undefined ? { options: options as NonNullable<Json> } : {}),
      };
      if (isLocal()) {
        await localUpdate('page_fields', id, patch);
        return;
      }
      const { error } = await supabase.from('page_fields').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from page_fields where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('page_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: settle,
  });

  return { add, update, remove };
}
