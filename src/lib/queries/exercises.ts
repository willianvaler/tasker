import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

// Biblioteca de exercícios (AC3.6, D235). Com o banco no aparelho, lê dele (funciona offline);
// o catálogo fica fora do cache em disco (é grande e o banco do aparelho já o tem).

export type Exercise = {
  id: string;
  name_en: string;
  name_pt: string | null;
  name_es: string | null;
  body_part: string;
  target: string | null;
  secondary: string[];
  equipment: string;
  kind: 'reps' | 'time' | 'cardio';
  /** Exercício próprio (da pessoa ou do projeto) */
  own?: boolean;
  folder_id?: string | null;
  notes?: string | null;
};

export type ExerciseDetail = Exercise & {
  level?: string | null;
  mechanic?: string | null;
  instructions: { en?: string[]; pt?: string[]; es?: string[] };
};

const LIST_COLUMNS = 'id, name_en, name_pt, name_es, body_part, target, secondary, equipment, kind';

/** text[] do Postgres chega como JSON ("[...]") ou como literal ("{a,b}") no SQLite */
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value) return [];
  if (value.startsWith('[')) return JSON.parse(value) as string[];
  return value
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((s) => s.replace(/^"|"$/g, ''))
    .filter(Boolean);
}

const fromRow = (row: Record<string, unknown>): Exercise =>
  ({ ...row, secondary: parseList(row.secondary) }) as Exercise;

/** Nome no idioma da tela (o inglês sempre existe). */
export function exerciseName(e: Pick<Exercise, 'name_en' | 'name_pt' | 'name_es'>, lang: string) {
  if (lang.startsWith('pt')) return e.name_pt || e.name_en;
  if (lang.startsWith('es')) return e.name_es || e.name_en;
  return e.name_en;
}

/** Catálogo + os meus exercícios próprios (e os dos meus projetos), sem as instruções. */
export function useExerciseCatalog() {
  return useQuery({
    queryKey: ['exercises'],
    meta: { persist: false },
    staleTime: 60 * 60 * 1000,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Exercise[]> => {
      if (isLocal()) {
        const [catalog, own] = await Promise.all([
          db.getAll<Record<string, unknown>>(`select ${LIST_COLUMNS} from exercises`),
          db.getAll<Record<string, unknown>>(
            `select id, name as name_en, null as name_pt, null as name_es, body_part, target,
                    '[]' as secondary, equipment, kind, folder_id, notes from user_exercises`,
          ),
        ]);
        return [...own.map((r) => ({ ...fromRow(r), own: true })), ...catalog.map(fromRow)];
      }
      // O servidor devolve no máximo 1.000 linhas por consulta: o catálogo vem em páginas
      const catalogRows: Record<string, unknown>[] = [];
      for (let from = 0; ; from += 1000) {
        const page = await supabase
          .from('exercises')
          .select(LIST_COLUMNS)
          .order('id')
          .range(from, from + 999);
        if (page.error) throw page.error;
        catalogRows.push(...(page.data as Record<string, unknown>[]));
        if (page.data.length < 1000) break;
      }
      const catalog = { data: catalogRows };
      const own = await supabase.from('user_exercises').select('*');
      if (own.error) throw own.error;
      return [
        ...(own.data ?? []).map(
          (u) =>
            ({
              id: u.id,
              name_en: u.name,
              name_pt: null,
              name_es: null,
              body_part: u.body_part,
              target: u.target,
              secondary: [],
              equipment: u.equipment,
              kind: u.kind,
              own: true,
              folder_id: u.folder_id,
              notes: u.notes,
            }) as Exercise,
        ),
        ...catalog.data.map(fromRow),
      ];
    },
  });
}

/** Ficha de um exercício, com as instruções. */
export function useExercise(id: string | null | undefined) {
  const catalog = useExerciseCatalog();
  const base = catalog.data?.find((e) => e.id === id);
  const detail = useQuery({
    queryKey: ['exercises', 'detail', id ?? ''],
    enabled: !!id && !!base && !base.own,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async () => {
      if (isLocal()) {
        const row = await db.getOptional<Record<string, unknown>>(
          'select level, mechanic, instructions from exercises where id = ?',
          [id],
        );
        return {
          level: (row?.level as string) ?? null,
          mechanic: (row?.mechanic as string) ?? null,
          instructions:
            typeof row?.instructions === 'string'
              ? JSON.parse(row.instructions)
              : (row?.instructions ?? {}),
        };
      }
      const { data, error } = await supabase
        .from('exercises')
        .select('level, mechanic, instructions')
        .eq('id', id ?? '')
        .single();
      if (error) throw error;
      return data as {
        level: string | null;
        mechanic: string | null;
        instructions: ExerciseDetail['instructions'];
      };
    },
  });
  const data: ExerciseDetail | undefined = base
    ? { ...base, ...(detail.data ?? {}), instructions: detail.data?.instructions ?? {} }
    : undefined;
  return { data, isPending: catalog.isPending || (!!base && !base.own && detail.isPending) };
}

export type NewUserExercise = {
  name: string;
  body_part: string;
  target?: string | null;
  equipment: string;
  kind: Exercise['kind'];
  notes?: string | null;
  folder_id?: string | null;
};

export function useUserExerciseMutations() {
  const queryClient = useQueryClient();
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['exercises'] });

  const create = useMutation({
    networkMode,
    mutationFn: async (input: NewUserExercise) => {
      const id = uuidv7();
      const now = new Date().toISOString();
      if (isLocal()) {
        await localInsert('user_exercises', {
          id,
          owner_id: await sessionUserId(),
          target: null,
          notes: null,
          folder_id: null,
          ...input,
          created_at: now,
          updated_at: now,
        });
        return id;
      }
      const { error } = await supabase.from('user_exercises').insert({ id, ...input });
      if (error) throw error;
      return id;
    },
    onSettled: refresh,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...patch }: Partial<NewUserExercise> & { id: string }) => {
      if (isLocal())
        return localUpdate('user_exercises', id, {
          ...patch,
          updated_at: new Date().toISOString(),
        });
      const { error } = await supabase.from('user_exercises').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from user_exercises where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('user_exercises').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  return { create, update, remove };
}
