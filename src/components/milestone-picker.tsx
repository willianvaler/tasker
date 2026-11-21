import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { useMilestones } from '@/lib/queries/milestones';
import { formatShortDate } from '@/lib/parser/dates';

/**
 * Marco da tarefa (GP3, D315): os marcos do projeto, um toque liga e outro solta. Só aparece em
 * projeto com marcos; o banco recusa marco de outro projeto.
 */
export function MilestonePicker({
  rootId,
  value,
  editable,
  onChange,
}: {
  rootId: string | undefined;
  value: string | null;
  editable: boolean;
  onChange: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const milestones = useMilestones(rootId);
  const open = (milestones.data ?? []).filter((m) => !m.done_at || m.id === value);
  if (!open.length) return null;
  return (
    <View className="gap-1 pt-2">
      <Text className="text-sm text-ink-muted">{t('roadmap.milestone')}</Text>
      <View
        role="radiogroup"
        aria-label={t('roadmap.milestone')}
        className="flex-row flex-wrap gap-2"
      >
        {open.map((m) => (
          <Chip
            key={m.id}
            role="radio"
            label={m.due_date ? `${m.name} · ${formatShortDate(m.due_date)}` : m.name}
            selected={value === m.id}
            disabled={!editable}
            onPress={() => onChange(value === m.id ? null : m.id)}
          />
        ))}
      </View>
    </View>
  );
}
