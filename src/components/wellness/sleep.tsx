import { Settings2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { addDays } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useSleep, useSleepActions } from '@/lib/queries/sleep';
import {
  clockText,
  formatDuration,
  parseClock,
  SLEEP_GOAL_LIMITS,
  sleepAverage,
  sleepMinutes,
  sleepWeek,
} from '@/lib/sleep';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';

type Dialog = 'log' | 'goal' | null;

/**
 * Sono (SA1, D384) no Bem-estar: a última noite contra a meta, registrar (dormi às, acordei às),
 * a semana em barras e a média. Fica dentro do
 * `HealthConsentGate` do Bem-estar.
 */
export function SleepSection() {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <SectionLabel title={t('sleep.title')} />
      <SleepBody />
    </View>
  );
}

function SleepBody() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const sleep = useSleep(today);
  const actions = useSleepActions(today);
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const fail = (e: Error) => toast({ message: e.message });
  const data = sleep.data;
  if (!data) return null;

  const week = sleepWeek(data.logs, today);
  const last = week[6].minutes || week[5].minutes;
  const max = Math.max(data.goal, ...week.map((d) => d.minutes));
  const recent = [...data.logs].reverse().slice(0, 5);
  const dayName = (day: string, weekday: 'short' | 'narrow') =>
    new Date(`${day}T12:00:00`).toLocaleDateString(i18n.language, { weekday });

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="font-serif text-xl text-ink">
          {last
            ? t('sleep.last', { duration: formatDuration(last), goal: formatDuration(data.goal) })
            : t('sleep.none')}
        </Text>
        <Text className="text-sm text-ink-muted">
          {t('sleep.average', { avg: formatDuration(sleepAverage(week)) })}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button label={t('sleep.log')} onPress={() => setDialog('log')} />
        <IconButton icon={Settings2} label={t('sleep.goal')} onPress={() => setDialog('goal')} />
      </View>

      {recent.length > 0 && (
        <View accessibilityLabel={t('sleep.recent')}>
          {recent.map((l) => (
            <View key={l.id} className="min-h-10 flex-row items-center gap-2 border-b border-line">
              <Text className="w-12 text-sm text-ink-muted">{dayName(l.day, 'short')}</Text>
              <Text className="flex-1 text-sm text-ink">
                {t('sleep.row', {
                  bed: l.bed_time.slice(0, 5),
                  wake: l.wake_time.slice(0, 5),
                  duration: formatDuration(sleepMinutes(l.bed_time, l.wake_time)),
                })}
              </Text>
              <IconButton
                icon={X}
                tone="danger"
                label={t('sleep.remove', { bed: l.bed_time.slice(0, 5) })}
                onPress={() => actions.remove.mutate(l.id, { onError: fail })}
              />
            </View>
          ))}
        </View>
      )}

      <View
        className="h-24 flex-row items-end gap-2"
        accessibilityRole="image"
        accessibilityLabel={t('sleep.chart')}
      >
        {week.map((d) => (
          <View
            key={d.day}
            className="flex-1 items-center gap-1"
            accessibilityLabel={t('sleep.bar', {
              day: dayName(d.day, 'short'),
              duration: formatDuration(d.minutes),
            })}
          >
            <View className="w-full flex-1 justify-end">
              <View
                className={d.minutes >= data.goal ? 'rounded-t bg-accent' : 'rounded-t bg-line'}
                style={{ height: `${max ? Math.max(2, (d.minutes / max) * 100) : 2}%` }}
              />
            </View>
            <Text className="text-xs text-ink-muted">{dayName(d.day, 'narrow')}</Text>
          </View>
        ))}
      </View>

      {dialog === 'log' && (
        <PromptDialog
          title={t('sleep.logTitle')}
          message={t('sleep.logHint')}
          fields={[
            { key: 'bed', placeholder: t('sleep.bedPlaceholder'), maxLength: 5 },
            { key: 'wake', placeholder: t('sleep.wakePlaceholder'), maxLength: 5 },
            { key: 'day', placeholder: t('sleep.dayPlaceholder'), initial: t('sleep.today') },
          ]}
          validate={(v) => {
            const bed = parseClock(v.bed);
            const wake = parseClock(v.wake);
            return bed !== null && wake !== null && bed !== wake && dayOf(v.day, t) !== null;
          }}
          confirmLabel={t('sleep.save')}
          onClose={() => setDialog(null)}
          onConfirm={(v) => {
            setDialog(null);
            const offset = dayOf(v.day, t) ?? 0;
            actions.add.mutate(
              {
                id: uuidv7(),
                day: addDays(today, offset),
                bed_time: clockText(parseClock(v.bed) ?? 0),
                wake_time: clockText(parseClock(v.wake) ?? 0),
              },
              { onError: fail },
            );
          }}
        />
      )}
      {dialog === 'goal' && (
        <PromptDialog
          title={t('sleep.goal')}
          message={t('sleep.goalHint')}
          fields={[
            {
              key: 'hours',
              placeholder: t('sleep.goalPlaceholder'),
              initial: String(data.goal / 60).replace('.', ','),
            },
          ]}
          validate={(v) => goalMinutes(v.hours) !== null}
          onClose={() => setDialog(null)}
          onConfirm={(v) => {
            setDialog(null);
            const goal = goalMinutes(v.hours);
            if (goal) actions.saveGoal.mutate({ goal, saved: data.saved }, { onError: fail });
          }}
        />
      )}
    </View>
  );
}

/** "hoje" ou "ontem" (o dia em que acordou), em qualquer dos 3 idiomas da tela. */
function dayOf(text: string, t: (k: 'sleep.today' | 'sleep.yesterday') => string): 0 | -1 | null {
  const v = text.trim().toLowerCase();
  if (!v || v === t('sleep.today').toLowerCase()) return 0;
  if (v === t('sleep.yesterday').toLowerCase()) return -1;
  return null;
}

/** Horas com vírgula ou ponto ("7,5") → minutos, dentro dos limites da meta. */
function goalMinutes(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const min = Math.round(n * 60);
  return min >= SLEEP_GOAL_LIMITS[0] && min <= SLEEP_GOAL_LIMITS[1] ? min : null;
}
