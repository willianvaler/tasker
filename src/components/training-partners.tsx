import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/person';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import type { PartnerSource } from '@/lib/queries/workout-session';

export type Partner = { userId: string; displayName: string; source?: PartnerSource };

/**
 * "Quem está treinando junto agora?" (V6 §15.4, AC10.2; AC15A): as pessoas da pasta, os amigos e
 * quem está nos mesmos times e grupos, para marcar antes de começar o Modo Treino ou para chamar
 * no meio dele (`mode="invite"`). Sem ninguém marcado, o treino é só seu.
 */
export function TrainingPartners({
  people,
  selected,
  onChange,
  onStart,
  onInvite,
  onCancel,
  mode = 'start',
  busy,
}: {
  people: Partner[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onStart: () => void;
  /** Sozinho no grupo: abre o convite da pasta. */
  onInvite?: () => void;
  /** No meio do treino: volta sem chamar ninguém. */
  onCancel?: () => void;
  mode?: 'start' | 'invite';
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const toggle = (userId: string) =>
    onChange(
      selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId],
    );
  const inviting = mode === 'invite';
  return (
    <View className="gap-4">
      <Text accessibilityRole="header" className="text-xl font-semibold text-ink">
        {t(inviting ? 'together.inviteTitle' : 'together.title')}
      </Text>
      <Text className="text-sm text-ink-muted">
        {t(people.length ? 'together.hint' : inviting ? 'together.nobody' : 'together.alone')}
      </Text>
      {people.length === 0 && onInvite && (
        <Button variant="ghost" label={t('together.invitePeople')} onPress={onInvite} />
      )}
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
            {person.source && (
              <Text className="font-mono text-xs uppercase text-ink-muted">
                {t(`together.source.${person.source}`)}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button
          label={
            inviting
              ? t('together.inviteSend', { count: selected.length })
              : selected.length
                ? t('together.startWith', { count: selected.length })
                : t('together.startAlone')
          }
          loading={busy}
          disabled={busy || (inviting && selected.length === 0)}
          onPress={onStart}
        />
        {onCancel && <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />}
      </View>
    </View>
  );
}
