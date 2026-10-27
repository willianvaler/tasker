import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { filterExercises } from '@/lib/gym/exercise-filter';
import { suggestExercises } from '@/lib/gym/exercise-match';
import { exerciseName, useExerciseCatalog, type Exercise } from '@/lib/queries/exercises';
import type { Task } from '@/lib/queries/tasks';
import { ExercisePhoto } from './exercise-photo';
import { equipmentLabel } from './labels';

/**
 * Item de treino ligado a um exercício da biblioteca (AC3.8, D235): mostra o ligado, ou sugere
 * pelo título ("Parece Supino reto com barra"); aceitar liga, ignorar mantém como texto.
 */
export function ExerciseLink({
  task,
  editable,
  onLink,
}: {
  task: Pick<Task, 'title' | 'exercise_id'>;
  editable: boolean;
  onLink: (exerciseId: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const catalog = useExerciseCatalog();
  const [picking, setPicking] = useState(false);
  const linked = catalog.data?.find((e) => e.id === task.exercise_id);
  const suggestion = useMemo(
    () =>
      task.exercise_id || !catalog.data
        ? null
        : (suggestExercises(task.title, catalog.data, 1, 0.6)[0]?.exercise ?? null),
    [task.exercise_id, task.title, catalog.data],
  );

  if (linked)
    return (
      <View className="gap-2">
        <ExercisePhoto
          exerciseId={linked.id}
          name={exerciseName(linked, i18n.language)}
          className="w-full max-w-xs"
        />
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="flex-1 text-sm text-ink">
            {t('library.linked', { name: exerciseName(linked, i18n.language) })}
          </Text>
          <Button
            variant="ghost"
            label={t('library.open')}
            onPress={() => router.push({ pathname: '/biblioteca/[id]', params: { id: linked.id } })}
          />
          {editable && (
            <Button variant="ghost" label={t('library.unlink')} onPress={() => onLink(null)} />
          )}
        </View>
      </View>
    );
  if (!editable) return null;
  return (
    <View className="gap-2">
      {suggestion && (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="flex-1 text-sm text-ink-muted">
            {t('library.suggestion', { name: exerciseName(suggestion, i18n.language) })}
          </Text>
          <Button
            variant="ghost"
            label={t('library.useSuggestion')}
            onPress={() => onLink(suggestion.id)}
          />
        </View>
      )}
      <Button
        variant="ghost"
        className="self-start"
        label={suggestion ? t('library.pick') : t('library.link')}
        onPress={() => setPicking(true)}
      />
      {picking && (
        <ExercisePicker
          initialQuery={task.title}
          list={catalog.data ?? []}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPicking(false);
            onLink(id);
          }}
        />
      )}
    </View>
  );
}

export function ExercisePicker({
  initialQuery,
  list,
  onPick,
  onClose,
}: {
  initialQuery: string;
  list: Exercise[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const name = (e: Exercise) => exerciseName(e, i18n.language);
  const found = useMemo(
    () => filterExercises(list, { query }, name).slice(0, 20),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, query, i18n.language],
  );
  return (
    <DialogFrame onClose={onClose} wide>
      <Text className="text-lg font-semibold text-ink">{t('library.pickTitle')}</Text>
      <Input
        value={query}
        onChangeText={setQuery}
        autoFocus
        placeholder={t('library.search')}
        accessibilityLabel={t('library.search')}
      />
      <View>
        {found.length === 0 && (
          <Text className="py-2 text-sm text-ink-muted">{t('library.empty')}</Text>
        )}
        {found.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={name(e)}
            onPress={() => onPick(e.id)}
            className="min-h-11 justify-center border-b border-line py-1 hover:bg-wash"
          >
            <Text className="text-sm text-ink">{name(e)}</Text>
            <Text className="text-xs text-ink-muted">{equipmentLabel(t, e.equipment)}</Text>
          </Pressable>
        ))}
      </View>
    </DialogFrame>
  );
}
