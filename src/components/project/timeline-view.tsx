import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { openTask } from '@/components/project/flow-parts';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { saveTextFile } from '@/lib/download';
import { useProjectEvents } from '@/lib/queries/events';
import { useMembers } from '@/lib/queries/projects';
import type { FolderNode } from '@/lib/queries/tree';
import {
  byDay,
  EVENT_GROUPS,
  eventMessage,
  eventsCsv,
  type EventGroup,
  type TaskEvent,
} from '@/lib/task-events';
import { useIsOnline } from '@/providers/online';

type Period = 'all' | '7' | '30';
const dayKey = (at: string) => new Date(at).toLocaleDateString('sv-SE');
/** Início do período (chamado ao escolher, nunca durante a renderização). */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/**
 * Linha do tempo do projeto (V3 §2.7): a auditoria em ordem, por dia, filtrável por pessoa, tipo
 * e período, com exportação CSV. Só para quem tem workflow.view_audit (a aba nem aparece).
 */
export function TimelineView({ root }: { root: FolderNode }) {
  const { t, i18n } = useTranslation();
  const online = useIsOnline();
  const members = useMembers(root.id);
  const [userId, setUserId] = useState<string>();
  const [group, setGroup] = useState<EventGroup>();
  const [period, setPeriod] = useState<{ value: Period; since?: string }>({ value: 'all' });
  const events = useProjectEvents(root.id, {
    userId,
    kinds: group ? EVENT_GROUPS[group] : undefined,
    since: period.since,
  });
  const list = events.data?.pages.flat() ?? [];
  const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const dayLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const describe = (e: TaskEvent) => {
    const m = eventMessage(e, t('events.someone'));
    return t(m.key, m.params);
  };

  function choosePeriod(value: Period) {
    setPeriod({
      value,
      since: value === 'all' ? undefined : daysAgo(Number(value)),
    });
  }

  function exportCsv() {
    const stamp = new Intl.DateTimeFormat('sv-SE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const csv = eventsCsv(
      list.map((e) => ({
        at: stamp.format(new Date(e.at)),
        who: e.actor?.display_name ?? '',
        kind: e.kind,
        title: String((e.payload as { title?: string } | null)?.title ?? ''),
        text: describe(e),
      })),
      [
        t('timeline.colAt'),
        t('timeline.colWho'),
        t('timeline.colKind'),
        t('timeline.colTask'),
        t('timeline.colText'),
      ],
    );
    void saveTextFile(`${root.name} - ${t('projectTabs.timeline')}.csv`, csv, 'text/csv');
  }

  const groups: (EventGroup | undefined)[] = [undefined, 'progress', 'flow', 'people', 'changes'];
  const periods: Period[] = ['all', '7', '30'];

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Filter label={t('timeline.who')}>
          <Chip
            label={t('timeline.everyone')}
            selected={!userId}
            onPress={() => setUserId(undefined)}
          />
          {members.data?.map((m) => (
            <Chip
              key={m.userId}
              label={m.displayName}
              selected={userId === m.userId}
              onPress={() => setUserId(m.userId)}
            />
          ))}
        </Filter>
        <Filter label={t('timeline.kind')}>
          {groups.map((g) => (
            <Chip
              key={g ?? 'all'}
              label={t(g ? `timeline.group_${g}` : 'timeline.allKinds')}
              selected={group === g}
              onPress={() => setGroup(g)}
            />
          ))}
        </Filter>
        <Filter label={t('timeline.period')}>
          {periods.map((p) => (
            <Chip
              key={p}
              label={t(`timeline.period_${p}`)}
              selected={period.value === p}
              onPress={() => choosePeriod(p)}
            />
          ))}
          <Button
            variant="ghost"
            icon={Download}
            label={t('timeline.export')}
            className="ml-auto"
            disabled={!list.length}
            onPress={exportCsv}
          />
        </Filter>
      </View>

      {!online && !events.data && <EmptyState title={t('events.offline')} />}
      {events.data && !list.length && <EmptyState title={t('timeline.empty')} />}

      {byDay(list, dayKey).map(({ day, events: dayEvents }) => (
        <View
          key={day}
          accessibilityRole="list"
          aria-label={dayLabel.format(new Date(dayEvents[0].at))}
        >
          <Text className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {dayLabel.format(new Date(dayEvents[0].at))}
          </Text>
          {dayEvents.map((e) => {
            const title = (e.payload as { title?: string } | null)?.title ?? '';
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}: ${describe(e)}`}
                onPress={() => openTask(e.task_id)}
                className="min-h-11 flex-row items-baseline gap-3 border-b border-line px-2 py-1 hover:bg-wash md:min-h-9"
              >
                <Text className="w-12 font-mono text-xs text-ink-muted">
                  {time.format(new Date(e.at))}
                </Text>
                <View className="flex-1">
                  <Text className="text-sm text-ink" numberOfLines={1}>
                    {title}
                  </Text>
                  <Text className="text-xs text-ink-muted" numberOfLines={2}>
                    {describe(e)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {events.hasNextPage && (
        <Button
          variant="ghost"
          label={t('events.more')}
          disabled={events.isFetchingNextPage}
          onPress={() => events.fetchNextPage()}
        />
      )}
    </View>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-2" role="group" aria-label={label}>
      <Text className="w-20 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}
