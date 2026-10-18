import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/person';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';

export type Partner = { userId: string; displayName: string };

/**
 * "Quem está treinando junto agora?" (V6 §15.4, AC10.2): as pessoas da pasta, para marcar antes
 * de começar o Modo Treino. Sem ninguém marcado, o treino é só seu.
 */
export function TrainingPartners({
  people,
  selected,
  onChange,
  onStart,
  busy,
}: {
  people: Partner[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onStart: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const toggle = (userId: string) =>
    onChange(
      selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId],
    );
  return (
    <View className="gap-4">
      <Text accessibilityRole="header" className="text-xl font-semibold text-ink">
        {t('together.title')}
      </Text>
      <Text className="text-sm text-ink-muted">{t('together.hint')}</Text>
      <View>
        {people.map((person) => (
          <Pressable
            key={person.userId}
            className="min-h-12 flex-row items-center gap-3 border-b border-line"
            onPress={() => toggle(person.userId)}
          >
            <Checkbox
              checked={selected.includes(person.userId)}
              onChange={() => toggle(person.userId)}
              label={person.displayName}
            />
            <Avatar name={person.displayName} size={32} />
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {person.displayName}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button
        label={
          selected.length
            ? t('together.startWith', { count: selected.length })
            : t('together.startAlone')
        }
        loading={busy}
        disabled={busy}
        onPress={onStart}
      />
    </View>
  );
}
