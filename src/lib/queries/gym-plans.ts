import { useState } from 'react';

import { planItemToTask, type GymPlan } from '@/lib/gym/plans';
import { useSetGymMode } from '@/lib/queries/profile';
import { useCreateTasks } from '@/lib/queries/tasks';
import { useTree, useTreeMutations } from '@/lib/queries/tree';
import { uuidv7 } from '@/lib/uuid';

export type PlanNames = {
  /** Nome da pasta (o do plano) */
  folder: string;
  workout: (key: string) => string;
  exercise: (id: string) => string;
};

/**
 * Usar um plano pronto (AC12.1): pasta dentro da Academia (que é ligada se ainda não estiver), um
 * treino por item do plano com os dias e a regra, e os exercícios com séries e descanso. Vai pelas
 * mesmas mutações do "Novo treino" e do lote (sem RPC nova): valem a RLS, os guardas e, depois da
 * primeira sincronização, o banco do aparelho. Exercício por tempo ganha a regra "tempo" já no
 * lote (D272).
 */
export function useCreatePlan() {
  const tree = useTree();
  const m = useTreeMutations();
  const createTasks = useCreateTasks();
  const setGymMode = useSetGymMode();
  const [pending, setPending] = useState(false);

  async function create(plan: GymPlan, names: PlanNames) {
    setPending(true);
    try {
      const gymId = tree.data?.gym?.id ?? (await setGymMode.mutateAsync(true));
      if (!gymId) throw new Error('Academia indisponível');
      const folderId = await m.createFolder.mutateAsync({
        name: names.folder,
        icon: plan.icon,
        parentId: gymId,
      });
      const firstPages: string[] = [];
      for (const workout of plan.workouts) {
        const pageId = await m.createPage.mutateAsync({
          folderId,
          name: names.workout(workout.key),
          icon: plan.icon,
          view_type: 'cards',
          reset_cycle: 'weekly',
          progression: plan.progression,
          train_days: [...workout.days],
        });
        firstPages.push(pageId);
        const items = workout.items.map((item) => {
          const { repeatPlan, meta, timed } = planItemToTask(item);
          return {
            id: uuidv7(),
            title: names.exercise(item.exercise),
            meta,
            repeatPlan,
            priority: 0 as const,
            dueDate: null,
            labels: [],
            mentions: [],
            prereqs: [],
            recurrence: null,
            exerciseId: item.exercise,
            ...(timed && plan.progression !== 'time' ? { progression: 'time' as const } : {}),
          };
        });
        await createTasks.mutateAsync({ pageId, items });
      }
      return { folderId, pageId: firstPages[0] };
    } finally {
      setPending(false);
    }
  }

  return { create, pending };
}
