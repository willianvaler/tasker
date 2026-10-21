import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BodyMap } from '@/components/gym/body-map';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { setsWork, workLevels, type MuscleSlug } from '@/lib/gym/muscle-volume';
import { useExerciseCatalog } from '@/lib/queries/exercises';
import { useUiPrefs } from '@/lib/queries/profile';

/** Um exercício do treino e quantas séries ele conta (previstas ou feitas) */
export type MuscleEntry = { exerciseId: string | null | undefined; sets: number };

/**
 * Mapa muscular de um treino (AC8.6): os músculos dos exercícios ligados à Biblioteca, pelas
 * séries de cada um. Na montagem fica recolhido numa linha com os nomes (`collapsible`); no resumo
 * do fim, aberto. Sem exercício ligado, não aparece.
 */
export function WorkoutMuscles({
  entries,
  title,
  collapsible,
}: {
  entries: MuscleEntry[];
  title: string;
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const catalog = useExerciseCatalog();
  const figure = useUiPrefs().gym?.figure === 'female' ? 'female' : 'male';
  const [open, setOpen] = useState(!collapsible);

  const byId = new Map((catalog.data ?? []).map((e) => [e.id, e]));
  const work = setsWork(
    entries.flatMap((e) => {
      const exercise = e.exerciseId ? byId.get(e.exerciseId) : undefined;
      return exercise
        ? [{ target: exercise.target, secondary: exercise.secondary, sets: e.sets }]
        : [];
    }),
  );
  // Do mais trabalhado para o menos
  const slugs = (Object.keys(work) as MuscleSlug[]).sort((a, b) => (work[b] ?? 0) - (work[a] ?? 0));
  if (!slugs.length) return null;
  const list = slugs.map((slug) => t(`stats.muscle_${slug}`)).join(', ');

  return (
    <View className="gap-2">
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          aria-expanded={open}
          onPress={() => setOpen(!open)}
          className="min-h-11 flex-row items-center gap-2 self-start rounded px-1 hover:bg-wash"
        >
          <Icon icon={open ? ChevronUp : ChevronDown} tone="ink-muted" />
          <Text className="text-sm text-ink-muted" numberOfLines={open ? undefined : 1}>
            {t('workoutMap.toggle', { title, list })}
          </Text>
        </Pressable>
      ) : (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {title}
          </Text>
          <Text className="text-sm text-ink">{list}</Text>
        </View>
      )}
      {open && (
        <View className="w-full max-w-md self-center">
          <BodyMap
            figure={figure}
            levels={workLevels(work)}
            label={t('stats.mapLabel', { list })}
            height={collapsible ? 200 : 220}
          />
        </View>
      )}
    </View>
  );
}
