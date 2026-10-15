import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { addDays, formatDueDate, todayIn } from '@/lib/parser/dates';
import { useMyTimeStats, useProjectTime } from '@/lib/queries/pomodoro';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import { useMembers } from '@/lib/queries/projects';
import type { FolderNode } from '@/lib/queries/tree';
import { formatDuration } from '@/lib/task-tree';
import { statsByDay, topBy } from '@/lib/time-stats';

// Relatórios de tempo (K4, D132): os números do pomodoro (hoje, 7 dias, onde foi o tempo) e o
// tempo registrado de um projeto, por lista e por pessoa.

/** Linha com rótulo, barra proporcional e valor (a barra é só reforço: o valor está no texto). */
function BarRow({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="min-h-9 flex-row items-center gap-3"
    >
      <Text className="w-28 text-sm text-ink" numberOfLines={1}>
        {label}
      </Text>
      <View className="h-2 flex-1 overflow-hidden rounded bg-wash">
        <View
          className="h-full rounded bg-accent"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </View>
      <Text className="w-20 text-right font-mono text-xs text-ink-muted">{value}</Text>
    </View>
  );
}

export function PomodoroStats() {
  const { t } = useTranslation();
  const today = useToday();
  const timeZone = useTimeZone();
  // Dois dias de folga: o fuso do registro pode cair no dia anterior
  const since = `${addDays(today, -8)}T00:00:00.000Z`;
  const entries = useMyTimeStats(since);
  const list = entries.data ?? [];
  const days = statsByDay(list, today, timeZone);
  const todayStat = days[days.length - 1];
  const week = new Set(days.map((d) => d.day));
  const max = Math.max(1, ...days.map((d) => d.minutes));
  // Onde foi o tempo nos 7 dias
  const top = topBy(
    list.filter((e) => week.has(todayIn(timeZone, new Date(e.ended_at)))),
    (e) => e.task_id,
    (e) => e.task_title ?? t('time.noTask'),
  );

  return (
    <View className="gap-4">
      <SectionLabel title={t('time.stats')} />
      <Text className="text-base text-ink">
        {t('time.today', {
          pomodoros: todayStat.pomodoros,
          time: formatDuration(todayStat.minutes),
        })}
      </Text>
      <View accessibilityRole="list">
        {days.map((d) => (
          <BarRow
            key={d.day}
            label={formatDueDate(d.day, today)}
            value={`${d.pomodoros} · ${formatDuration(d.minutes)}`}
            ratio={d.minutes / max}
          />
        ))}
      </View>
      {top.length > 0 && (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('time.topTasks')}
          </Text>
          {top.map((row) => (
            <BarRow
              key={row.key}
              label={row.label}
              value={formatDuration(row.minutes)}
              ratio={row.minutes / top[0].minutes}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Tempo registrado no projeto (aba Lista): total, por lista e por pessoa. Some sem registros. */
export function ProjectTime({ root }: { root: FolderNode }) {
  const { t } = useTranslation();
  const folderIds = [root.id, ...root.children.map((c) => c.id)];
  const entries = useProjectTime(folderIds);
  const members = useMembers(root.id);
  const list = entries.data ?? [];
  if (list.length === 0) return null;
  const names = new Map((members.data ?? []).map((m) => [m.userId, m.displayName]));
  const total = list.reduce((sum, e) => sum + e.minutes, 0);
  const byList = topBy(
    list,
    (e) => e.page_id,
    (e) => e.page_name ?? '—',
  );
  const byPerson = topBy(
    list,
    (e) => e.user_id,
    (e) => names.get(e.user_id) ?? '—',
  );
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('time.project')}
        </Text>
        <Text className="font-mono text-xs text-ink-muted">{formatDuration(total)}</Text>
      </View>
      {byList.map((row) => (
        <BarRow
          key={row.key}
          label={row.label}
          value={formatDuration(row.minutes)}
          ratio={row.minutes / total}
        />
      ))}
      {byPerson.length > 1 && (
        <View className="pt-2">
          {byPerson.map((row) => (
            <BarRow
              key={row.key}
              label={row.label}
              value={formatDuration(row.minutes)}
              ratio={row.minutes / total}
            />
          ))}
        </View>
      )}
    </View>
  );
}
