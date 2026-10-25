import { useState } from 'react';

import type { Meal } from '@/lib/diet';
import { useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { useCreateTasks, usePageTasks } from '@/lib/queries/tasks';
import { useTree, useTreeMutations } from '@/lib/queries/tree';
import { uuidv7 } from '@/lib/uuid';

/**
 * O cardápio da semana (BE2, D275): uma lista comum numa pasta "Dieta", lembrada em
 * `ui_prefs.wellness.diet`. Apagada a lista, volta a oferecer montar outra.
 */
export function useDiet() {
  const tree = useTree();
  const prefs = useUiPrefs();
  const pageId = prefs.wellness?.diet?.pageId;
  const page = pageId ? tree.data?.pages.find((p) => p.id === pageId) : undefined;
  const tasks = usePageTasks(page?.id);
  return { page, tasks, loading: tree.isPending };
}

/** Pasta "Dieta" com a lista "Cardápio da semana" e o vínculo nas preferências. */
export function useStartDiet() {
  const m = useTreeMutations();
  const prefs = useUiPrefs();
  const update = useUpdateUiPrefs();
  const [pending, setPending] = useState(false);
  async function start(names: { folder: string; page: string }) {
    setPending(true);
    try {
      const folderId = await m.createFolder.mutateAsync({
        name: names.folder,
        icon: 'lucide:utensils',
      });
      const pageId = await m.createPage.mutateAsync({
        folderId,
        name: names.page,
        icon: 'lucide:utensils',
        view_type: 'list',
        // Prato marcado vale até a semana virar
        reset_cycle: 'weekly',
      });
      await update.mutateAsync({ wellness: { ...prefs.wellness, diet: { pageId } } });
      return pageId;
    } finally {
      setPending(false);
    }
  }
  return { start, pending };
}

/** Prato num dia da semana e numa refeição, com os ingredientes como subtarefas. */
export function useAddDish() {
  const create = useCreateTasks();
  return (
    pageId: string,
    dish: { title: string; meal: Meal; days: number[]; ingredients: string[] },
  ) => {
    const days = [...new Set(dish.days)].sort((a, b) => a - b);
    const blank = { priority: 0 as const, labels: [], mentions: [], prereqs: [], recurrence: null };
    return create.mutateAsync({
      pageId,
      items: [
        {
          ...blank,
          id: uuidv7(),
          title: dish.title,
          meta: { meal: dish.meal, days },
          repeatPlan: null,
          dueDate: null,
          children: dish.ingredients.map((title) => ({
            ...blank,
            id: uuidv7(),
            title,
            meta: null,
            repeatPlan: null,
            dueDate: null,
          })),
        },
      ],
    });
  };
}
