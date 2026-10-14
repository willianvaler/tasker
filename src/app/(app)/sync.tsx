import { useQuery, useStatus } from '@powersync/react';
import { uuidv7 } from '@/lib/uuid';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { POWERSYNC_URL } from '@/lib/sync/connector';
import { db } from '@/lib/sync/db';
import { toggleTaskFn } from '@/lib/queries/tasks';
import { useSession } from '@/providers/session';

type Row = { id: string; title: string; status: string };


// Estado da sincronização e o banco local por dentro: lê só do SQLite do aparelho, então funciona
// sem conexão
export default function SyncScreen() {
  const { t } = useTranslation();
  const status = useStatus();
  const { session } = useSession();
  const [title, setTitle] = useState('');

  const counts = useQuery<{ folders: number; pages: number; tasks: number; pending: number }>(
    `select (select count(*) from folders) as folders, (select count(*) from pages) as pages,
            (select count(*) from tasks) as tasks, (select count(*) from ps_crud) as pending`,
  ).data[0];
  const inbox = useQuery<{ id: string; folder_id: string }>(
    'select id, folder_id from pages where is_inbox = 1 limit 1',
  ).data[0];
  const tasks = useQuery<Row>(
    `select id, title, status from tasks where parent_task_id is null
       order by status = 'done', created_at desc limit 30`,
  ).data;

  async function add() {
    if (!title.trim() || !inbox || !session) return;
    const now = new Date().toISOString();
    await db.execute(
      `insert into tasks (id, page_id, folder_id, title, status, priority, position, labels,
         created_by, created_at, updated_at, habit_kind, count_up, count_down)
       values (?, ?, ?, ?, 'todo', 0, ?, '[]', ?, ?, ?, 'check', 0, 0)`,
      [uuidv7(), inbox.id, inbox.folder_id, title.trim(), Date.now(), session.user.id, now, now],
    );
    setTitle('');
  }

  const toggle = (task: Row) => toggleTaskFn({ id: task.id, done: task.status !== 'done' });

  const last = status.lastSyncedAt;
  return (
    <Screen size="medium">
      <ScreenHeader title={t('sync.title')} back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-12">
        {!POWERSYNC_URL && <Text className="text-sm text-warn">{t('sync.disabled')}</Text>}
        <Text className="text-base text-ink">
          {status.connected ? t('sync.connected') : t('sync.offline')}
        </Text>
        <Text className="font-mono text-xs text-ink-muted">
          {t('sync.lastSynced', { when: last ? last.toLocaleString() : t('sync.never') })}
        </Text>
        {counts && (
          <>
            <Text className="font-mono text-xs text-ink-muted">{t('sync.local', counts)}</Text>
            <Text className="font-mono text-xs text-ink-muted">
              {t('sync.pending', { count: counts.pending })}
            </Text>
          </>
        )}
        <SectionLabel title={t('sync.recent')} className="pt-4" />
        <Input
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          submitBehavior="submit"
          placeholder={t('sync.addPlaceholder')}
          accessibilityLabel={t('sync.addPlaceholder')}
        />
        {tasks.map((task) => (
          <View key={task.id} className="min-h-10 flex-row items-center gap-3 border-b border-line">
            <Checkbox
              checked={task.status === 'done'}
              onChange={() => toggle(task)}
              label={task.title}
            />
            <Text className="flex-1 text-sm text-ink">{task.title}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
