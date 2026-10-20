import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { BODY_PARTS, EQUIPMENT } from '@/lib/gym/exercise-filter';
import { useUserExerciseMutations, type Exercise } from '@/lib/queries/exercises';
import { useToast } from '@/providers/toast';
import { bodyPartLabel, equipmentLabel } from './labels';

/** Exercício próprio (V6 §2): nome e parte do corpo bastam; equipamento e jeito de registrar ajudam. */
export function NewExerciseDialog({
  initialName = '',
  folderId,
  onClose,
  onCreated,
}: {
  initialName?: string;
  /** Do projeto/grupo (todos usam); sem isto, só da pessoa */
  folderId?: string | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { create } = useUserExerciseMutations();
  const [name, setName] = useState(initialName);
  const [bodyPart, setBodyPart] = useState<string>('other');
  const [equipment, setEquipment] = useState<string>('other');
  const [kind, setKind] = useState<Exercise['kind']>('reps');

  function save() {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), body_part: bodyPart, equipment, kind, folder_id: folderId ?? null },
      {
        onSuccess: (id) => {
          onClose();
          toast({ message: t('library.created', { name: name.trim() }) });
          onCreated?.(id);
        },
        onError: (err) => toast({ message: err.message }),
      },
    );
  }

  return (
    <DialogFrame onClose={onClose} wide>
      <Text className="text-lg font-semibold text-ink">{t('library.newTitle')}</Text>
      <Input
        value={name}
        onChangeText={setName}
        maxLength={80}
        placeholder={t('library.name')}
        accessibilityLabel={t('library.name')}
      />
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('library.bodyPart')}
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {BODY_PARTS.map((p) => (
          <Chip
            key={p}
            role="radio"
            label={bodyPartLabel(t, p)}
            selected={bodyPart === p}
            onPress={() => setBodyPart(p)}
          />
        ))}
      </View>
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('library.equipment')}
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {EQUIPMENT.map((e) => (
          <Chip
            key={e}
            role="radio"
            label={equipmentLabel(t, e)}
            selected={equipment === e}
            onPress={() => setEquipment(e)}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {(['reps', 'time', 'cardio'] as const).map((k) => (
          <Chip
            key={k}
            role="radio"
            label={t(`library.kind.${k}`)}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button
          label={t('library.new')}
          disabled={!name.trim()}
          loading={create.isPending}
          onPress={save}
        />
      </View>
    </DialogFrame>
  );
}
