import { useQuery, useStatus } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useSyncState } from '@/components/sync-dot';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { toggleTaskFn } from '@/lib/queries/tasks';
import { connector, POWERSYNC_URL } from '@/lib/sync/connector';
import { db } from '@/lib/sync/db';
import { pendingXp } from '@/lib/sync/pending-xp';
import { uuidv7 } from '@/lib/uuid';
import { useSession } from '@/providers/session';

type Row = { id: string; title: string; status: string };
type Pending = { tx_id: number; data: string };

// Estado da sincronização e o banco do aparelho por dentro. Lê só do SQLite local, então funciona
// sem conexão
export default function SyncScreen() {
  const { t } = useTranslation();
  const status = useStatus();
  const state = useSyncState();
  const { session } = useSession();
  const [title, setTitle] = useState('');
  const [discarding, setDiscarding, closeDiscard] = useDialog<true>();

  const counts = useQuery<{ folders: number; pages: number; tasks: number; pending: number }>(
    `select (select count(*) from folders) as folders, (select count(*) from pages) as pages,
            (select count(*) from tasks) as tasks,
            (select count(distinct tx_id) from ps_crud) as pending`,
  ).data[0];
  // O parâmetro só existe para reler quando a contagem muda: depois de limpar o banco, a consulta
  // só sobre ps_crud não é avisada
  const pending = useQuery<Pending>(
    'select tx_id, data from ps_crud where ? >= 0 order by id limit 50',
    [counts?.pending ?? 0],
  ).data;
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
         created_by, created_at, updated_at, habit_kind, count_up, count_down, version)
       values (?, ?, ?, ?, 'todo', 0, ?, '[]', ?, ?, ?, 'check', 0, 0, 1)`,
      [uuidv7(), inbox.id, inbox.folder_id, title.trim(), Date.now(), session.user.id, now, now],
    );
    setTitle('');
  }

  const toggle = (task: Row) => toggleTaskFn({ id: task.id, done: task.status !== 'done' });

  async function force() {
    await db.disconnect();
    await db.connect(connector, { crudUploadThrottleMs: 0 });
  }

  async function discard() {
    closeDiscard();
    // Apaga o banco do aparelho inteiro (fila incluída) e baixa de novo
    pendingXp.clear();
    await db.disconnectAndClear();
    await db.connect(connector, { crudUploadThrottleMs: 0 });
  }

  // Uma linha por transação da fila: "Tarefa: editar · Ação: complete_task"
  const groups = new Map<number, string[]>();
  for (const row of pending) {
    const op = JSON.parse(row.data) as { op: string; type: string; data?: { name?: string } };
    const what =
      op.type === 'commands'
        ? `${t('sync.table_commands')}: ${op.data?.name ?? ''}`
        : `${t(`sync.table_${op.type}` as 'sync.table_tasks')}: ${t(`sync.op_${op.op}` as 'sync.op_PUT')}`;
    groups.set(row.tx_id, [...(groups.get(row.tx_id) ?? []), what]);
  }

  const last = status.lastSyncedAt;
  return (
    <Screen size="medium">
      <ScreenHeader help="sem-internet" title={t('sync.title')} back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-12">
        {!POWERSYNC_URL && <Text className="text-sm text-warn">{t('sync.disabled')}</Text>}
        <Text className="text-base text-ink">{t(`sync.state_${state}`)}</Text>
        <Text className="text-xs text-ink-muted">
          {status.connected ? t('sync.connected') : t('sync.offline')}
        </Text>
        <Text className="font-mono text-xs text-ink-muted">
          {t('sync.lastSynced', { when: last ? last.toLocaleString() : t('sync.never') })}
        </Text>
        {counts && (
          <Text className="font-mono text-xs text-ink-muted">
            {t('sync.pending', { count: counts.pending })}
          </Text>
        )}
        {(status.dataFlowStatus.uploadError || status.dataFlowStatus.downloadError) && (
          <Text className="font-mono text-xs text-danger">
            {(status.dataFlowStatus.uploadError ?? status.dataFlowStatus.downloadError)?.message}
          </Text>
        )}
        <View className="flex-row flex-wrap gap-2">
          <Button label={t('sync.force')} onPress={force} disabled={!POWERSYNC_URL} />
          <Button
            variant="ghost"
            label={t('sync.discard')}
            onPress={() => setDiscarding(true)}
            disabled={!POWERSYNC_URL}
          />
        </View>

        <SectionLabel title={t('sync.pendingTitle')} count={groups.size} className="pt-4" />
        {groups.size === 0 && (
          <Text className="text-sm text-ink-muted">{t('sync.pendingEmpty')}</Text>
        )}
        {[...groups.entries()].map(([tx, items]) => (
          <Text key={tx} className="font-mono text-xs text-ink">
            {items.join(' · ')}
          </Text>
        ))}

        <SectionLabel title={t('sync.device')} className="pt-4" />
        {counts && (
          <Text className="font-mono text-xs text-ink-muted">{t('sync.local', counts)}</Text>
        )}
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
      {discarding && (
        <ConfirmDialog
          title={t('sync.discardTitle')}
          message={t('sync.discardMessage')}
          confirmLabel={t('sync.discardConfirm')}
          onClose={closeDiscard}
          onConfirm={discard}
        />
      )}
    </Screen>
  );
}
