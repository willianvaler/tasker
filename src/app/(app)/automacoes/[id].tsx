import { useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import {
  ACTIONS,
  ruleParams,
  TRIGGERS,
  type AutomationAction,
  type AutomationTrigger,
  type RuleDraft,
} from '@/lib/automations';
import { actorCan } from '@/lib/permissions';
import {
  useAutomationMutations,
  useAutomations,
  type AutomationRule,
} from '@/lib/queries/automations';
import { useFolderActor, useMembers } from '@/lib/queries/projects';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Automações do projeto (M6, D143): as regras como frases, ligar/desligar, apagar e criar.

const WHEN = {
  task_done: 'auto.whenDone',
  task_ready: 'auto.whenReady',
  task_assigned: 'auto.whenAssigned',
  page_done: 'auto.whenPageDone',
  task_overdue: 'auto.whenOverdue',
} as const satisfies Record<AutomationTrigger, string>;
const THEN = {
  create_task: 'auto.doCreate',
  assign: 'auto.doAssign',
  notify: 'auto.doNotify',
  add_label: 'auto.doLabel',
  move: 'auto.doMove',
  rest_timer: 'auto.doRest',
} as const satisfies Record<AutomationAction, string>;

type Named = Map<string, string>;

function sentence(rule: AutomationRule, t: TFunction, pages: Named, people: Named) {
  const p = (rule.params ?? {}) as Record<string, string | number | undefined>;
  const page = rule.page_id ? ` ${t('auto.inPage', { page: pages.get(rule.page_id) ?? '—' })}` : '';
  const when = `${t(WHEN[rule.trigger as AutomationTrigger])}${page}`;
  const then = t(THEN[rule.action as AutomationAction], {
    title: p.title ?? '',
    page: p.page_id ? (pages.get(String(p.page_id)) ?? '—') : t('auto.samePage'),
    name: p.user_id ? (people.get(String(p.user_id)) ?? '—') : '',
    to: t(p.to === 'assignees' ? 'auto.toAssignees' : 'auto.toCreator'),
    label: p.label ?? '',
    seconds: p.seconds ?? 0,
  });
  return `${when}, ${then}`;
}

export default function AutomationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const tree = useTree();
  const place = findFolder(tree.data, id);
  const folder = place?.folder;
  const actor = useFolderActor(id);
  const canManage = actorCan(actor, 'automation.manage') && online;
  const members = useMembers(folder?.is_shared ? id : undefined);
  const data = useAutomations(id);
  const m = useAutomationMutations(id);
  const onError = (err: Error) => toast({ message: err.message });

  const folderIds = folder
    ? [folder.id, ...('children' in folder ? folder.children : []).map((c: { id: string }) => c.id)]
    : [];
  const pageList = (tree.data?.pages ?? []).filter((p) => folderIds.includes(p.folder_id));
  const pages: Named = new Map(pageList.map((p) => [p.id, pageLabel(p)]));
  const people: Named = new Map((members.data ?? []).map((x) => [x.userId, x.displayName]));

  const [draft, setDraft] = useState<RuleDraft>({
    trigger: 'task_done',
    pageId: null,
    action: 'create_task',
  });
  const set = (patch: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const params = ruleParams(draft);

  function create() {
    if (!params) return;
    m.add.mutate(
      { trigger: draft.trigger, action: draft.action, page_id: draft.pageId, params },
      { onError, onSuccess: () => toast({ message: t('auto.created') }) },
    );
  }

  const rules = data.data?.rules ?? [];
  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader help="organizar-o-dia" title={t('auto.title')} eyebrow={folder?.name} back />
        <Text className="text-sm text-ink-muted">{t('auto.hint')}</Text>
        {rules.length === 0 && <Text className="text-sm text-ink-muted">{t('auto.empty')}</Text>}
        {rules.map((rule) => {
          const text = sentence(rule, t, pages, people);
          return (
            <View key={rule.id} className="gap-1 border-b border-line pb-2">
              <ToggleRow
                title={text}
                hint={rule.runs ? t('auto.runs', { count: rule.runs }) : undefined}
                value={rule.enabled}
                disabled={!canManage}
                onChange={(enabled) => m.toggle.mutate({ id: rule.id, enabled }, { onError })}
              />
              {canManage && (
                <IconButton
                  icon={X}
                  label={t('auto.remove', { rule: text })}
                  onPress={() => m.remove.mutate(rule.id, { onError })}
                />
              )}
            </View>
          );
        })}

        {canManage && (
          <View className="gap-3">
            <SectionLabel title={t('auto.new')} />
            <Text className="text-xs text-ink-muted">{t('auto.when')}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {TRIGGERS.map((k) => (
                <Chip
                  key={k}
                  role="radio"
                  label={t(WHEN[k])}
                  selected={draft.trigger === k}
                  onPress={() => set({ trigger: k })}
                />
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              <Chip
                role="radio"
                label={t('auto.anyPage')}
                selected={!draft.pageId}
                onPress={() => set({ pageId: null })}
              />
              {pageList.map((p) => (
                <Chip
                  key={p.id}
                  role="radio"
                  label={pageLabel(p)}
                  selected={draft.pageId === p.id}
                  onPress={() => set({ pageId: p.id })}
                />
              ))}
            </View>
            <Text className="text-xs text-ink-muted">{t('auto.then')}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {ACTIONS.map((k) => (
                <Chip
                  key={k}
                  role="radio"
                  label={t(`auto.action_${k}`)}
                  selected={draft.action === k}
                  onPress={() => set({ action: k })}
                />
              ))}
            </View>
            {draft.action === 'create_task' && (
              <Input
                value={draft.title ?? ''}
                onChangeText={(title) => set({ title })}
                placeholder={t('auto.titlePlaceholder')}
                accessibilityLabel={t('auto.titleField')}
              />
            )}
            {(draft.action === 'create_task' || draft.action === 'move') && (
              <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                {draft.action === 'create_task' && (
                  <Chip
                    role="radio"
                    label={t('auto.samePage')}
                    selected={!draft.targetPageId}
                    onPress={() => set({ targetPageId: null })}
                  />
                )}
                {pageList.map((p) => (
                  <Chip
                    key={p.id}
                    role="radio"
                    label={pageLabel(p)}
                    selected={draft.targetPageId === p.id}
                    onPress={() => set({ targetPageId: p.id })}
                  />
                ))}
              </View>
            )}
            {draft.action === 'assign' && (
              <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                {[...people.entries()].map(([userId, name]) => (
                  <Chip
                    key={userId}
                    role="radio"
                    label={name}
                    selected={draft.userId === userId}
                    onPress={() => set({ userId })}
                  />
                ))}
                {people.size === 0 && (
                  <Text className="text-sm text-ink-muted">{t('auto.noPeople')}</Text>
                )}
              </View>
            )}
            {draft.action === 'notify' && (
              <>
                <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                  {(['creator', 'assignees'] as const).map((to) => (
                    <Chip
                      key={to}
                      role="radio"
                      label={t(to === 'creator' ? 'auto.toCreator' : 'auto.toAssignees')}
                      selected={(draft.to ?? 'creator') === to}
                      onPress={() => set({ to })}
                    />
                  ))}
                </View>
                <Input
                  value={draft.message ?? ''}
                  onChangeText={(message) => set({ message })}
                  maxLength={200}
                  placeholder={t('auto.messagePlaceholder')}
                  accessibilityLabel={t('auto.messageField')}
                />
              </>
            )}
            {draft.action === 'add_label' && (
              <Input
                value={draft.label ?? ''}
                onChangeText={(label) => set({ label })}
                autoCapitalize="none"
                placeholder="#urgente"
                accessibilityLabel={t('auto.labelField')}
              />
            )}
            {draft.action === 'rest_timer' && (
              <Input
                value={draft.seconds ? String(draft.seconds) : ''}
                onChangeText={(v) => set({ seconds: parseInt(v, 10) || undefined })}
                keyboardType="number-pad"
                placeholder="60"
                accessibilityLabel={t('auto.secondsField')}
              />
            )}
            <Button
              label={t('auto.create')}
              disabled={!params || m.add.isPending}
              onPress={create}
              className="self-start"
            />
          </View>
        )}

        {(data.data?.log.length ?? 0) > 0 && (
          <View className="gap-1">
            <SectionLabel title={t('auto.log')} />
            {data.data?.log.map((entry) => (
              <Text
                key={entry.id}
                className={
                  entry.ok ? 'font-mono text-xs text-ink-muted' : 'font-mono text-xs text-warn'
                }
              >
                {new Date(entry.at).toLocaleString()} ·{' '}
                {entry.ok ? t('auto.ok') : t('auto.failed', { message: entry.message ?? '' })}
              </Text>
            ))}
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}
