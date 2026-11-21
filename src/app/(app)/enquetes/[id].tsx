import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';

import { PollForm } from '@/components/agenda/poll-form';
import { useWhen } from '@/components/agenda/public';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { webUrl } from '@/lib/queries/projects';
import { ownerSlots, useTimePoll, useTimePollActions } from '@/lib/queries/time-poll';
import { bestSlots, type PollSlot } from '@/lib/time-poll';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/**
 * Uma enquete de horário (AG4, D319): o link para mandar, cada horário com quem marcou e "Fechar
 * neste horário", que vira tarefa com horário na lista da agenda (a mesma das reservas).
 */
export default function PollScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const when = useWhen();
  const { id } = useLocalSearchParams<{ id: string }>();
  const poll = useTimePoll(id);
  const { close, remove } = useTimePollActions();
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState<PollSlot | null>(null);
  const [removing, setRemoving] = useState(false);

  const data = poll.data;
  if (!data)
    return (
      <Screen size="medium">
        <ScreenHeader back help="agenda" title={t('poll.title')} />
        {poll.isSuccess && <EmptyState title={t('poll.missing')} />}
        {poll.error && (
          <Text className="text-sm text-danger">
            {t('common.loadError', { message: poll.error.message })}
          </Text>
        )}
      </Screen>
    );
  const url = webUrl(`/horario/${data.token}`);
  const slots = ownerSlots(data);
  const best = new Set(bestSlots(slots));
  const open = data.status === 'open';
  const people = data.votes.length;

  async function copy() {
    await Clipboard.setStringAsync(url);
    toast({ message: t('share.copied') });
  }

  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="pb-clear">
        <ScreenHeader back help="agenda" title={data.title} />
        <View className={cn(READABLE, 'gap-6')}>
          <Text className="text-ink-muted">
            {[formatDuration(data.duration_min), data.note].filter(Boolean).join(' · ')}
          </Text>

          {open ? (
            <View className="gap-2">
              <SectionLabel title={t('poll.link')} />
              <Text
                selectable
                testID="poll-link"
                className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
              >
                {url}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button icon={Copy} label={t('share.copy')} onPress={copy} />
                {Platform.OS === 'web' && (
                  <Button
                    variant="ghost"
                    icon={ExternalLink}
                    label={t('poll.openPage')}
                    onPress={() => Linking.openURL(url)}
                  />
                )}
                <Button
                  variant="ghost"
                  icon={Pencil}
                  label={t('poll.edit')}
                  disabled={!online}
                  onPress={() => setEditing(true)}
                />
              </View>
              <Text className="text-xs text-ink-muted">{t('poll.linkHint')}</Text>
            </View>
          ) : (
            <View className="gap-2 rounded border border-line p-4">
              <Text className="text-ink">
                {data.chosen_slot
                  ? t('poll.closedOn', {
                      when: when(slots.find((s) => s.id === data.chosen_slot)?.starts_at ?? ''),
                    })
                  : t('poll.closed')}
              </Text>
              {data.task_id && (
                <Button
                  variant="ghost"
                  className="self-start"
                  label={t('poll.openTask')}
                  onPress={() =>
                    router.push({ pathname: '/task/[id]', params: { id: data.task_id ?? '' } })
                  }
                />
              )}
            </View>
          )}

          <View className="gap-1">
            <SectionLabel title={t('poll.answers', { count: people })} />
            {slots.map((slot) => (
              <View
                key={slot.id}
                accessibilityLabel={t('poll.slotSummary', {
                  when: when(slot.starts_at),
                  count: slot.names.length,
                })}
                className="gap-2 border-b border-line py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Text
                    className={cn(
                      'flex-1 text-ink',
                      best.has(slot.id) && 'font-semibold',
                      data.chosen_slot === slot.id && 'text-accent',
                    )}
                  >
                    {when(slot.starts_at)}
                  </Text>
                  <Text className="font-mono text-xs text-ink-muted">
                    {slot.names.length}/{people}
                  </Text>
                </View>
                <ProgressBar
                  value={people ? slot.names.length / people : 0}
                  label={t('poll.slotSummary', {
                    when: when(slot.starts_at),
                    count: slot.names.length,
                  })}
                />
                {slot.names.length > 0 && (
                  <Text className="text-xs text-ink-muted">{slot.names.join(', ')}</Text>
                )}
                {open && (
                  <Button
                    variant="ghost"
                    icon={Check}
                    className="self-start"
                    label={t('poll.closeHere')}
                    accessibilityLabel={t('poll.closeAt', { when: when(slot.starts_at) })}
                    disabled={!online}
                    onPress={() => setClosing(slot)}
                  />
                )}
              </View>
            ))}
          </View>

          {data.votes.some((v) => v.email) && (
            <View className="gap-1">
              <SectionLabel title={t('poll.contacts')} />
              {data.votes
                .filter((v) => v.email)
                .map((v) => (
                  <Text key={v.id} selectable className="text-sm text-ink">
                    {v.name} · {v.email}
                  </Text>
                ))}
            </View>
          )}

          <Button
            variant="ghost"
            destructive
            icon={Trash2}
            className="self-start"
            label={t('poll.delete')}
            disabled={!online}
            onPress={() => setRemoving(true)}
          />
        </View>
      </ScreenScroll>

      {editing && (
        <PollForm poll={data} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}
      {closing && (
        <ConfirmDialog
          title={t('poll.closeTitle')}
          message={t('poll.closeMessage', { when: when(closing.starts_at) })}
          confirmLabel={t('poll.closeHere')}
          onClose={() => setClosing(null)}
          onConfirm={() => {
            const slot = closing;
            setClosing(null);
            close.mutateAsync({ id: data.id, slot: slot.id }).then(
              () => toast({ message: t('poll.closedToast') }),
              (e: Error) => toast({ message: e.message }),
            );
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t('poll.deleteTitle')}
          message={t('poll.deleteMessage')}
          confirmLabel={t('poll.delete')}
          destructive
          onClose={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            remove.mutateAsync(data.id).then(
              () => router.back(),
              (e: Error) => toast({ message: e.message }),
            );
          }}
        />
      )}
    </Screen>
  );
}
