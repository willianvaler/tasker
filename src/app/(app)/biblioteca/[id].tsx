import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { bodyPartLabel, equipmentLabel, muscleLabel } from '@/components/gym/labels';
import { ExerciseHistory } from '@/components/gym/exercise-history';
import { ExerciseRecords, OneRmCalculator } from '@/components/gym/exercise-records';
import { PlateCalculator } from '@/components/gym/plates';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { exerciseName, useExercise, useUserExerciseMutations } from '@/lib/queries/exercises';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/** Ficha do exercício (AC3.7, D235): músculos, equipamento e como fazer. */
export default function ExerciseScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useExercise(id);
  const { remove } = useUserExerciseMutations();
  const toast = useToast();
  const me = useSession().session?.user.id;
  const e = exercise.data;

  if (!exercise.isPending && !e)
    return (
      <Screen size="medium">
        <ScreenHeader title={t('library.title')} back />
        <EmptyState title={t('library.missing')} />
      </Screen>
    );

  const lang = i18n.language.startsWith('pt') ? 'pt' : i18n.language.startsWith('es') ? 'es' : 'en';
  const steps = e?.instructions[lang]?.length ? e.instructions[lang] : (e?.instructions.en ?? []);
  return (
    <Screen size="medium">
      <ScreenHeader
        title={e ? exerciseName(e, i18n.language) : '…'}
        eyebrow={
          e ? `${bodyPartLabel(t, e.body_part)} · ${t(`library.kind.${e.kind}`)}` : undefined
        }
        back
      />
      <ScreenScroll contentContainerClassName="gap-6 pb-12">
        {e && (
          <View className="gap-1">
            <Fact label={t('library.equipment')} value={equipmentLabel(t, e.equipment)} />
            {e.target && <Fact label={t('library.target')} value={muscleLabel(t, e.target)} />}
            {e.secondary.length > 0 && (
              <Fact
                label={t('library.secondary')}
                value={e.secondary.map((m) => muscleLabel(t, m)).join(', ')}
              />
            )}
            {e.level && (
              <Fact
                label={t('library.levelLabel')}
                value={t(`library.level.${e.level as 'beginner'}`, { defaultValue: e.level })}
              />
            )}
            {i18n.language.startsWith('pt') && e.name_pt && e.name_en !== e.name_pt && (
              <Text className="text-xs text-ink-muted">{e.name_en}</Text>
            )}
          </View>
        )}
        {e && !e.own && (
          <View className="gap-2">
            <SectionLabel title={t('library.howTo')} className="pt-0" />
            {steps.length === 0 ? (
              <Text className="text-sm text-ink-muted">{t('library.noSteps')}</Text>
            ) : (
              steps.map((step, i) => (
                <Text key={i} className="text-sm text-ink">{`${i + 1}. ${step}`}</Text>
              ))
            )}
          </View>
        )}
        {e?.own && e.notes ? <Text className="text-sm text-ink">{e.notes}</Text> : null}
        {e && <ExerciseRecords exerciseId={e.id} />}
        {e && <ExerciseHistory exerciseId={e.id} />}
        <OneRmCalculator />
        <PlateCalculator />
        {e?.own && me && (
          <Button
            variant="ghost"
            className="self-start"
            label={t('library.delete')}
            onPress={() =>
              remove.mutate(e.id, {
                onSuccess: () => router.back(),
                onError: (err) => toast({ message: err.message }),
              })
            }
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-2">
      <Text className="w-36 text-sm text-ink-muted">{label}</Text>
      <Text className="flex-1 text-sm text-ink">{value}</Text>
    </View>
  );
}
