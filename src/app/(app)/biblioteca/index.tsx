import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { bodyPartLabel, equipmentLabel, muscleLabel } from '@/components/gym/labels';
import { NewExerciseDialog } from '@/components/gym/new-exercise-dialog';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { BODY_PARTS, EQUIPMENT, filterExercises } from '@/lib/gym/exercise-filter';
import { exerciseName, useExerciseCatalog, type Exercise } from '@/lib/queries/exercises';
import { localStore } from '@/lib/storage';

const PAGE = 60;
const EQUIPMENT_KEY = 'questlist:my-equipment';

function savedEquipment(): string[] {
  try {
    const value: unknown = JSON.parse(localStore.getItem(EQUIPMENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Biblioteca de exercícios (AC3.7, D235): busca, equipamento que a pessoa tem, parte do corpo. */
export default function LibraryScreen() {
  const { t, i18n } = useTranslation();
  const catalog = useExerciseCatalog();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<string[]>(savedEquipment);
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [creating, setCreating] = useState(false);
  const name = (e: Exercise) => exerciseName(e, i18n.language);

  const list = useMemo(
    () => filterExercises(catalog.data ?? [], { query, equipment, bodyPart }, name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog.data, query, equipment, bodyPart, i18n.language],
  );

  function toggleEquipment(e: string) {
    const next = equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e];
    setEquipment(next);
    localStore.setItem(EQUIPMENT_KEY, JSON.stringify(next));
  }

  return (
    <Screen size="medium">
      <ScreenHeader
        title={t('library.title')}
        back
        right={
          <Button
            variant="ghost"
            icon={Plus}
            label={t('library.new')}
            onPress={() => setCreating(true)}
          />
        }
      />
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-12">
        <Text className="text-sm text-ink-muted">{t('library.intro')}</Text>
        <Input
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setShown(PAGE);
          }}
          placeholder={t('library.search')}
          accessibilityLabel={t('library.search')}
        />
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('library.myEquipment')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EQUIPMENT.map((e) => (
              <Chip
                key={e}
                role="checkbox"
                label={equipmentLabel(t, e)}
                selected={equipment.includes(e)}
                onPress={() => toggleEquipment(e)}
              />
            ))}
          </View>
        </View>
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('library.bodyPart')}
          </Text>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            <Chip
              role="radio"
              label={t('library.all')}
              selected={!bodyPart}
              onPress={() => setBodyPart(null)}
            />
            {BODY_PARTS.filter((p) => p !== 'other').map((p) => (
              <Chip
                key={p}
                role="radio"
                label={bodyPartLabel(t, p)}
                selected={bodyPart === p}
                onPress={() => setBodyPart(bodyPart === p ? null : p)}
              />
            ))}
          </View>
        </View>

        <View className="gap-1">
          <SectionLabel title={t('library.count', { count: list.length })} className="pt-0" />
          {!catalog.isPending && list.length === 0 && <EmptyState title={t('library.empty')} />}
          {list.slice(0, shown).map((e) => (
            <ExerciseRow key={e.id} exercise={e} name={name(e)} />
          ))}
          {list.length > shown && (
            <Button
              variant="ghost"
              className="self-start"
              label={t('library.more')}
              onPress={() => setShown(shown + PAGE)}
            />
          )}
        </View>
      </ScreenScroll>
      {creating && (
        <NewExerciseDialog
          initialName={query}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push({ pathname: '/biblioteca/[id]', params: { id } })}
        />
      )}
    </Screen>
  );
}

function ExerciseRow({ exercise: e, name }: { exercise: Exercise; name: string }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => router.push({ pathname: '/biblioteca/[id]', params: { id: e.id } })}
      className="min-h-12 justify-center gap-1 border-b border-line py-2 hover:bg-wash"
    >
      <Text className="text-sm text-ink">
        {name}
        {e.own ? ` · ${t('library.own')}` : ''}
      </Text>
      <Text className="text-xs text-ink-muted">
        {[equipmentLabel(t, e.equipment), e.target ? muscleLabel(t, e.target) : null]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </Pressable>
  );
}
