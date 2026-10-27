import { Library } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { exerciseName, useExerciseCatalog } from '@/lib/queries/exercises';
import { useCreateTasks } from '@/lib/queries/tasks';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';
import { ExercisePicker } from './exercise-link';

/**
 * Treino: escolher um exercício da biblioteca e criar o item já ligado a ele, sem precisar abrir
 * o item depois para ligar (o vínculo ficava só nos detalhes).
 */
export function AddFromLibrary({ pageId, disabled }: { pageId: string; disabled?: boolean }) {
  const { t, i18n } = useTranslation();
  const catalog = useExerciseCatalog();
  const create = useCreateTasks();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  // No celular, só o ícone (a linha já tem o campo, a estrutura e o "Vários")
  const wide = useWindowDimensions().width >= 768;

  function add(exerciseId: string) {
    setPicking(false);
    const exercise = catalog.data?.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const name = exerciseName(exercise, i18n.language);
    create.mutate({
      pageId,
      items: [
        {
          id: uuidv7(),
          title: name,
          priority: 0,
          dueDate: null,
          labels: [],
          recurrence: null,
          meta: null,
          repeatPlan: null,
          mentions: [],
          prereqs: [],
          exerciseId,
        },
      ],
    });
    toast({ message: t('gym.added', { name }) });
  }

  return (
    <>
      {wide ? (
        <Button
          variant="ghost"
          icon={Library}
          label={t('gym.fromLibrary')}
          accessibilityLabel={t('gym.fromLibraryLabel')}
          disabled={disabled}
          onPress={() => setPicking(true)}
        />
      ) : (
        <IconButton
          icon={Library}
          label={t('gym.fromLibraryLabel')}
          disabled={disabled}
          onPress={() => setPicking(true)}
        />
      )}
      {picking && (
        <ExercisePicker
          initialQuery=""
          list={catalog.data ?? []}
          onClose={() => setPicking(false)}
          onPick={add}
        />
      )}
    </>
  );
}
