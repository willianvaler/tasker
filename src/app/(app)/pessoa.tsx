import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { formatDueDate } from '@/lib/parser/dates';
import { useFriendActions, useProfileView, type ProfileView } from '@/lib/queries/friends';
import { useToday } from '@/lib/queries/profile';
import { useToast } from '@/providers/toast';

/** Perfil de uma pessoa (ESCOPO_V10 §2, D232): o que ela deixou ver e a amizade. */
export default function PersonProfileScreen() {
  const { t } = useTranslation();
  const { nick } = useLocalSearchParams<{ nick: string }>();
  const profile = useProfileView(nick);
  const data = profile.data;

  if (!profile.isPending && !data)
    return (
      <Screen size="medium">
        <ScreenHeader title={`@${nick}`} back />
        <EmptyState title={t('person.notFound', { nick })} />
      </Screen>
    );

  const open = (data?.tasks ?? []).filter((task) => task.status !== 'done');
  const done = (data?.tasks ?? []).filter((task) => task.status === 'done');
  return (
    <Screen size="medium">
      <ScreenHeader
        title={data?.display_name ?? '…'}
        eyebrow={data ? `@${data.username}` : undefined}
        back
      />
      <ScreenScroll contentContainerClassName="gap-8 pb-12">
        {data && !data.me && <FriendshipBar person={data} />}
        <TaskList title={t('person.open')} tasks={open} empty={t('person.openEmpty')} />
        {done.length > 0 && <TaskList title={t('person.done')} tasks={done} />}
        {data && (
          <Text className="text-xs text-ink-muted">
            {data.me ? t('person.mineHint') : t('person.hint')}
          </Text>
        )}
      </ScreenScroll>
    </Screen>
  );
}

function FriendshipBar({ person }: { person: ProfileView }) {
  const { t } = useTranslation();
  const toast = useToast();
  const actions = useFriendActions();
  const onError = (err: Error) => toast({ message: err.message });
  if (person.friendship === 'accepted')
    return <Text className="text-sm text-ok">{t('person.friends')}</Text>;
  if (person.friend_request_incoming)
    return (
      <Button
        className="self-start"
        label={t('friends.accept')}
        accessibilityLabel={t('friends.acceptLabel', { name: person.display_name })}
        onPress={() =>
          actions.respond.mutate({ userId: person.user_id, accept: true }, { onError })
        }
      />
    );
  if (person.friendship === 'pending')
    return <Text className="text-sm text-ink-muted">{t('person.requested')}</Text>;
  return (
    <Button
      className="self-start"
      label={t('friends.request')}
      loading={actions.request.isPending}
      onPress={() =>
        actions.request.mutate(
          { username: person.username },
          {
            onSuccess: () =>
              toast({ message: t('friends.sent', { query: `@${person.username}` }) }),
            onError,
          },
        )
      }
    />
  );
}

function TaskList({
  title,
  tasks,
  empty,
}: {
  title: string;
  tasks: ProfileView['tasks'];
  empty?: string;
}) {
  const { t } = useTranslation();
  const today = useToday();
  return (
    <View className="gap-1">
      <SectionLabel title={title} count={tasks.length} className="pt-0" />
      {tasks.length === 0 && empty && <Text className="py-2 text-sm text-ink-muted">{empty}</Text>}
      {tasks.map((task) => (
        <View
          key={task.id}
          className="min-h-11 flex-row items-center gap-3 border-b border-line py-2"
        >
          <Text
            className="text-sm"
            accessibilityLabel={t(
              task.visibility === 'public' ? 'visibility.publicLabel' : 'visibility.friendsLabel',
            )}
          >
            {task.visibility === 'public' ? '🌐' : '👥'}
          </Text>
          <View className="flex-1">
            <Text
              className={
                task.status === 'done' ? 'text-sm text-ink-muted line-through' : 'text-sm text-ink'
              }
            >
              {task.title}
            </Text>
            <Text className="font-mono text-xs text-ink-muted">
              {[
                task.page_icon ? `${task.page_icon} ${task.page}` : task.page,
                task.due_date ? formatDueDate(task.due_date, today) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
