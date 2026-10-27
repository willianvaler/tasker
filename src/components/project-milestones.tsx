import { MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { StampBox } from '@/components/ui/checkbox';
import { ActionMenu, PromptDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { milestoneState, type MilestoneState } from '@/lib/milestones';
import { formatShortDate } from '@/lib/parser/dates';
import { parseQuickInput } from '@/lib/parser/quick';
import { actorCan } from '@/lib/permissions';
import { useMilestoneMutations, useMilestones, type Milestone } from '@/lib/queries/milestones';
import { useToday } from '@/lib/queries/profile';
import { useFolderActor } from '@/lib/queries/projects';
import { isLocal } from '@/lib/sync/local';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';
import { contextMenu } from '@/lib/context-menu';

/** "sexta" → a data; vazio → sem data; texto que não é data → undefined (não mexe). */
function parseDate(text: string, today: string): string | null | undefined {
  if (!text.trim()) return null;
  return parseQuickInput(`x ${text}`, { today }).dueDate ?? undefined;
}

export function useMilestoneLabel() {
  const { t } = useTranslation();
  return (state: MilestoneState) => {
    switch (state.kind) {
      case 'done':
        return t('project.done');
      case 'undated':
        return t('project.undated');
      case 'late':
        return t('project.late', { count: state.days });
      case 'today':
        return t('project.dueToday');
      default:
        return t('project.inDays', { count: state.days });
    }
  };
}

/** Marcos do projeto: datas-chave com o quanto falta. Criar com a sintaxe rápida ("Compras sexta"). */
export function ProjectMilestones({ rootId }: { rootId: string }) {
  const { t } = useTranslation();
  const today = useToday();
  const milestones = useMilestones(rootId);
  const m = useMilestoneMutations(rootId);
  const actor = useFolderActor(rootId);
  const online = useIsOnline();
  const toast = useToast();
  const label = useMilestoneLabel();
  const [draft, setDraft] = useState('');
  const [menu, setMenu, closeMenu] = useDialog<Milestone>();
  const [editing, setEditing, closeEditing] = useDialog<Milestone>();
  const canEdit = actorCan(actor, 'page.manage') && (online || isLocal());
  const onError = (err: Error) => toast({ message: t('share.error', { message: err.message }) });
  const list = milestones.data ?? [];

  if (!canEdit && list.length === 0) return null;

  function create() {
    const parsed = parseQuickInput(draft, { today });
    if (!parsed.title) return;
    m.create.mutate({ name: parsed.title, dueDate: parsed.dueDate }, { onError });
    setDraft('');
  }

  return (
    <View>
      <SectionLabel title={t('project.milestones')} count={list.length} className="pt-0" />
      {list.length === 0 && (
        <Text className="py-2 text-sm text-ink-muted">{t('project.milestonesEmpty')}</Text>
      )}
      {list.map((milestone) => {
        const state = milestoneState(milestone, today);
        const done = state.kind === 'done';
        return (
          <View
            key={milestone.id}
            className="min-h-11 flex-row items-center gap-3 border-b border-line md:min-h-10"
            {...contextMenu(canEdit ? () => setMenu(milestone) : undefined)}
          >
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={done}
              accessibilityLabel={t(
                done ? 'project.milestoneReopen' : 'project.milestoneComplete',
                {
                  name: milestone.name,
                },
              )}
              disabled={!canEdit}
              hitSlop={8}
              onPress={() =>
                m.update.mutate(
                  { id: milestone.id, done_at: done ? null : new Date().toISOString() },
                  { onError },
                )
              }
            >
              <StampBox checked={done} />
            </Pressable>
            <Text
              className={cn('flex-1 text-sm', done ? 'text-ink-muted line-through' : 'text-ink')}
              numberOfLines={1}
            >
              {milestone.name}
            </Text>
            <Text
              className={cn(
                'font-mono text-xs',
                state.kind === 'late'
                  ? 'text-danger'
                  : state.kind === 'today'
                    ? 'text-warn'
                    : 'text-ink-muted',
              )}
            >
              {milestone.due_date && !done ? `${formatShortDate(milestone.due_date)} · ` : ''}
              {label(state)}
            </Text>
            {canEdit && (
              <IconButton
                icon={MoreHorizontal}
                label={t('project.milestoneOptions', { name: milestone.name })}
                onPress={() => setMenu(milestone)}
              />
            )}
          </View>
        );
      })}
      {canEdit && (
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder={t('project.milestonePlaceholder')}
          accessibilityLabel={t('project.milestonePlaceholder')}
          submitBehavior="submit"
          onSubmitEditing={create}
          className="mt-2"
          maxLength={100}
        />
      )}

      {menu && (
        <ActionMenu
          title={menu.name}
          actions={[
            { label: t('project.milestoneEdit'), onPress: () => setEditing(menu) },
            {
              label: t('project.milestoneDelete'),
              destructive: true,
              onPress: () => m.remove.mutate(menu.id, { onError }),
            },
          ]}
          onClose={closeMenu}
        />
      )}
      {editing && (
        <PromptDialog
          title={t('project.milestoneEdit')}
          fields={[
            { key: 'name', placeholder: t('project.milestoneName'), initial: editing.name },
            {
              key: 'date',
              placeholder: t('project.milestoneDate'),
              // dd/mm/aaaa: o mesmo formato que a sintaxe rápida lê de volta
              initial: editing.due_date ? editing.due_date.split('-').reverse().join('/') : '',
            },
          ]}
          onClose={closeEditing}
          onConfirm={({ name, date }) => {
            const target = editing;
            closeEditing();
            const dueDate = parseDate(date, today);
            m.update.mutate(
              { id: target.id, name, ...(dueDate === undefined ? {} : { due_date: dueDate }) },
              { onError },
            );
          }}
        />
      )}
    </View>
  );
}
