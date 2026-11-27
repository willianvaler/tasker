import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Food, FoodInput } from '../recipes';
import { supabase } from '../supabase';
import { db } from '../sync/db';
import { isLocal, localInsert, localUpdate, sessionUserId } from '../sync/local';
import { uuidv7 } from '../uuid';

/**
 * Tabela nutricional da própria pessoa (SA5, D391): os alimentos com os valores por 100 g, por
 * 100 mL ou por unidade. Lê e grava no aparelho depois da primeira sincronização.
 */
const KEY = ['nutrition'] as const;
const COLS = 'id, name, basis, kcal, protein, carbs, fat';

export function useFoods() {
  return useQuery({
    queryKey: KEY,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<Food[]> => {
      const userId = await sessionUserId();
      if (!userId) return [];
      if (isLocal()) {
        return db.getAll<Food>(
          `select ${COLS} from nutrition_foods where user_id = ? order by name`,
          [userId],
        );
      }
      const { data, error } = await supabase
        .from('nutrition_foods')
        .select(COLS)
        .eq('user_id', userId)
        .order('name');
      if (error) throw error;
      return (data ?? []).map((f) => ({
        ...f,
        basis: f.basis as Food['basis'],
        kcal: Number(f.kcal),
        protein: Number(f.protein),
        carbs: Number(f.carbs),
        fat: Number(f.fat),
      }));
    },
  });
}

export function useFoodMutations() {
  const queryClient = useQueryClient();
  const networkMode = isLocal() ? ('always' as const) : ('online' as const);
  const patch = (fn: (list: Food[]) => Food[]) =>
    queryClient.setQueryData<Food[]>(KEY, (list) => fn(list ?? []));
  const settle = () => queryClient.invalidateQueries({ queryKey: KEY });

  async function insert(rows: Food[]) {
    if (isLocal()) {
      const userId = await sessionUserId();
      const now = new Date().toISOString();
      for (const row of rows)
        await localInsert('nutrition_foods', {
          ...row,
          user_id: userId,
          created_at: now,
          updated_at: now,
        });
      return;
    }
    const { error } = await supabase.from('nutrition_foods').insert(rows);
    if (error) throw error;
  }

  /** Um ou vários (o CSV): ids gerados aqui, para entrar na tela antes de gravar */
  const add = useMutation({
    networkMode,
    mutationFn: (rows: Food[]) => insert(rows),
    onMutate: async (rows) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      patch((list) => [...list, ...rows].sort((a, b) => a.name.localeCompare(b.name)));
    },
    onSettled: settle,
  });

  const update = useMutation({
    networkMode,
    mutationFn: async ({ id, ...values }: Food) => {
      if (isLocal()) {
        await localUpdate('nutrition_foods', id, {
          ...values,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const { error } = await supabase.from('nutrition_foods').update(values).eq('id', id);
      if (error) throw error;
    },
    onMutate: async (food) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      patch((list) => list.map((f) => (f.id === food.id ? food : f)));
    },
    onSettled: settle,
  });

  const remove = useMutation({
    networkMode,
    mutationFn: async (id: string) => {
      if (isLocal()) {
        await db.execute('delete from nutrition_foods where id = ?', [id]);
        return;
      }
      const { error } = await supabase.from('nutrition_foods').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => patch((list) => list.filter((f) => f.id !== id)),
    onSettled: settle,
  });

  return { add, update, remove };
}

export const newFood = (input: FoodInput): Food => ({ id: uuidv7(), ...input });
