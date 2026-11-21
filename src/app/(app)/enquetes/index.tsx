import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { PollForm } from '@/components/agenda/poll-form';
import { useWhen } from '@/components/agenda/public';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useTimePolls, type OwnerPoll } from '@/lib/queries/time-poll';
import { useIsOnline } from '@/providers/online';

/**
 * Enquetes de horário (AG4, D319): propor de 2 a 5 horários a quem não está no app, mandar o link e
 * fechar no que serve para mais gente. Pede conexão, como a agenda.
 */
export default function PollsScreen() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const polls = useTimePolls();
  const [creating, setCreating] = useState(false);
  const list = polls.data ?? [];
  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="pb-clear">
        <ScreenHeader back help="agenda" title={t('poll.title')} />
        <View className={cn(READABLE, 'gap-6')}>
          <Text className="text-ink-muted">{t('poll.intro')}</Text>
          <Button
            className="self-start"
            icon={Plus}
            label={t('poll.new')}
            disabled={!online}
            onPress={() => setCreating(true)}
          />
          {polls.isSuccess && list.length === 0 && <EmptyState title={t('poll.empty')} />}
          {polls.error && (
            <Text className="text-sm text-danger">
              {t('common.loadError', { message: polls.error.message })}
            </Text>
          )}
          <View>
            {list.map((poll) => (
              <PollRow key={poll.id} poll={poll} />
            ))}
          </View>
        </View>
      </ScreenScroll>
      {creating && (
        <PollForm
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            router.push({ pathname: '/enquetes/[id]', params: { id } });
          }}
        />
      )}
    </Screen>
  );
}

function PollRow({ poll }: { poll: OwnerPoll }) {
  const { t } = useTranslation();
  const when = useWhen();
  const chosen = poll.slots.find((s) => s.id === poll.chosen_slot);
  const status =
    poll.status === 'closed'
      ? chosen
        ? t('poll.closedOn', { when: when(chosen.starts_at) })
        : t('poll.closed')
      : t('poll.answers', { count: poll.votes.length });
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${poll.title}, ${status}`}
      onPress={() => router.push({ pathname: '/enquetes/[id]', params: { id: poll.id } })}
      className="min-h-14 flex-row items-center gap-3 border-b border-line py-2 hover:bg-wash"
    >
      <View className="flex-1 gap-1">
        <Text className="text-ink">{poll.title}</Text>
        <Text className="text-xs text-ink-muted">{status}</Text>
      </View>
      <Icon icon={ChevronRight} tone="ink-muted" />
    </Pressable>
  );
}
