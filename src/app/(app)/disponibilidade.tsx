import { CalendarOff, Copy, X } from 'lucide-react-native';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  WEEKDAYS,
  clock,
  copyToWeekdays,
  formatIntervals,
  parseDayText,
  weekFromRules,
  weeklyMinutes,
  windowsOn,
  type AvailabilityException,
  type Week,
} from '@/lib/availability';
import { addDays, formatShortDate, weekdayShort, type IsoDate } from '@/lib/parser/dates';
import { parseQuickInput } from '@/lib/parser/quick';
import { useAvailability, useAvailabilityActions } from '@/lib/queries/availability';
import { useToday } from '@/lib/queries/profile';
import { cn } from '@/lib/cn';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Disponibilidade da agenda (AG1, D310): os horários em que a pessoa aceita compromissos, por dia da
// semana, e as exceções por data. Cada dia é um campo de texto ("9-12, 14-18"), que é mais rápido
// de digitar que um relógio por trecho e funciona igual no teclado e no leitor de tela.
export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const data = useAvailability(today);
  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <ScreenHeader back help="agenda" title={t('availability.title')} />
        <View className={cn(READABLE, 'gap-8')}>
          <Text className="text-ink-muted">{t('availability.intro')}</Text>
          {data.error ? (
            <Text className="text-danger">{t('availability.loadError')}</Text>
          ) : data.data ? (
            <>
              <WeekEditor
                key={JSON.stringify(data.data.rules)}
                week={weekFromRules(data.data.rules)}
                exceptions={data.data.exceptions}
                today={today}
              />
              <Exceptions exceptions={data.data.exceptions} today={today} />
            </>
          ) : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const dayName = (day: number) => weekdayShort(day % 7);

function WeekEditor({
  week,
  exceptions,
  today,
}: {
  week: Week;
  exceptions: AvailabilityException[];
  today: IsoDate;
}) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const { saveWeek } = useAvailabilityActions();
  const initial = useMemo(
    () => Object.fromEntries(WEEKDAYS.map((d) => [d, formatIntervals(week[d] ?? [])])),
    [week],
  );
  const [texts, setTexts] = useState<Record<number, string>>(initial);

  const parsed = WEEKDAYS.map((d) => ({ day: d, result: parseDayText(texts[d] ?? '') }));
  const valid = parsed.every((p) => p.result.ok);
  const draft: Week = Object.fromEntries(
    parsed.map((p) => [p.day, p.result.ok ? p.result.intervals : []]),
  );
  const changed = WEEKDAYS.some((d) => formatIntervals(draft[d]) !== initial[d]);
  const hours = weeklyMinutes(draft) / 60;

  function copyMonday() {
    const next = copyToWeekdays(draft, 1);
    setTexts((cur) => ({
      ...cur,
      ...Object.fromEntries([1, 2, 3, 4, 5].map((d) => [d, formatIntervals(next[d])])),
    }));
  }

  function save() {
    saveWeek
      .mutateAsync(draft)
      .then(() => toast({ message: t('availability.saved') }))
      .catch((e: Error) => toast({ message: t('availability.saveError', { message: e.message }) }));
  }

  const upcoming = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <>
      <View className="gap-3">
        <SectionLabel title={t('availability.week')} />
        <Text className="text-sm text-ink-muted">{t('availability.weekHint')}</Text>
        {parsed.map(({ day, result }) => (
          <View key={day} className="flex-row items-start gap-3">
            <Text className="w-12 pt-2 font-semibold capitalize text-ink">{dayName(day)}</Text>
            <View className="flex-1 gap-1">
              <Input
                className="font-mono"
                value={texts[day] ?? ''}
                onChangeText={(v) => setTexts((cur) => ({ ...cur, [day]: v }))}
                onBlur={() => {
                  // Ao sair do campo, mostra como ficou ("9-12" → "09:00–12:00")
                  if (result.ok)
                    setTexts((cur) => ({ ...cur, [day]: formatIntervals(result.intervals) }));
                }}
                placeholder={t('availability.closed')}
                editable={online}
                accessibilityLabel={t('availability.dayLabel', { day: dayName(day) })}
              />
              {!result.ok && (
                <Text className="text-sm text-danger">{t('availability.dayInvalid')}</Text>
              )}
            </View>
          </View>
        ))}
        <View className="flex-row flex-wrap items-center gap-2">
          <Button
            label={t('common.save')}
            disabled={!changed || !valid || !online}
            loading={saveWeek.isPending}
            onPress={save}
          />
          <Button
            variant="ghost"
            icon={Copy}
            label={t('availability.copyMonday')}
            disabled={!online || !(texts[1] ?? '').trim()}
            onPress={copyMonday}
          />
        </View>
        <Text className="text-sm text-ink-muted">
          {hours > 0
            ? t('availability.weekTotal', { hours: Math.round(hours * 10) / 10 })
            : t('availability.weekEmpty')}
        </Text>
        {!online && <Text className="text-sm text-ink-muted">{t('availability.offline')}</Text>}
      </View>

      <View className="gap-2">
        <SectionLabel title={t('availability.preview')} />
        {upcoming.map((date) => {
          const windows = windowsOn(date, draft, exceptions);
          return (
            <View key={date} className="flex-row gap-3">
              <Text className="w-28 text-ink">{formatShortDate(date)}</Text>
              <Text
                className={windows.length ? 'flex-1 font-mono text-ink' : 'flex-1 text-ink-muted'}
              >
                {windows.length ? formatIntervals(windows) : t('availability.unavailable')}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

function exceptionText(e: AvailabilityException, t: TFunction) {
  const days =
    e.starts_on === e.ends_on
      ? formatShortDate(e.starts_on)
      : t('availability.range', {
          from: formatShortDate(e.starts_on),
          to: formatShortDate(e.ends_on),
        });
  const when =
    e.starts && e.ends ? `${clock(e.starts)}–${clock(e.ends)}` : t('availability.wholeDay');
  return [days, when, e.note].filter(Boolean).join(' · ');
}

function Exceptions({
  exceptions,
  today,
}: {
  exceptions: AvailabilityException[];
  today: IsoDate;
}) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const { addException, removeException } = useAvailabilityActions();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  const readDate = (text: string) =>
    text.trim() ? (parseQuickInput(`x ${text}`, { today }).dueDate ?? null) : null;
  const startsOn = readDate(from);
  const endsOn = to.trim() ? readDate(to) : startsOn;
  const range = hours.trim() ? parseDayText(hours) : null;
  const trecho = range?.ok && range.intervals.length === 1 ? range.intervals[0] : null;

  const problem =
    from.trim() && !startsOn
      ? t('availability.dateInvalid')
      : to.trim() && !endsOn
        ? t('availability.dateInvalid')
        : startsOn && endsOn && endsOn < startsOn
          ? t('availability.rangeInvalid')
          : hours.trim() && !trecho
            ? t('availability.hoursInvalid')
            : null;
  const ready = !!startsOn && !!endsOn && !problem;

  function add() {
    if (!startsOn || !endsOn) return;
    addException
      .mutateAsync({
        starts_on: startsOn,
        ends_on: endsOn,
        starts: trecho?.starts ?? null,
        ends: trecho?.ends ?? null,
        note: note.trim() || null,
      })
      .then(() => {
        setFrom('');
        setTo('');
        setHours('');
        setNote('');
      })
      .catch((e: Error) => toast({ message: t('availability.saveError', { message: e.message }) }));
  }

  return (
    <View className="gap-3">
      <SectionLabel title={t('availability.exceptions')} count={exceptions.length || undefined} />
      <Text className="text-sm text-ink-muted">{t('availability.exceptionsHint')}</Text>
      {exceptions.length === 0 ? (
        <Text className="text-ink-muted">{t('availability.noExceptions')}</Text>
      ) : (
        exceptions.map((e) => (
          <View key={e.id} className="flex-row items-center gap-2">
            <Icon icon={CalendarOff} tone="ink-muted" />
            <Text className="flex-1 text-ink">{exceptionText(e, t)}</Text>
            <IconButton
              icon={X}
              tone="danger"
              disabled={!online}
              label={t('availability.removeException', { what: exceptionText(e, t) })}
              onPress={() => removeException.mutate(e.id)}
            />
          </View>
        ))
      )}

      <View className="gap-2 pt-2">
        <View className="flex-row gap-2">
          <Input
            className="flex-1"
            value={from}
            onChangeText={setFrom}
            placeholder={t('availability.fromPlaceholder')}
            editable={online}
            accessibilityLabel={t('availability.from')}
          />
          <Input
            className="flex-1"
            value={to}
            onChangeText={setTo}
            placeholder={t('availability.toPlaceholder')}
            editable={online}
            accessibilityLabel={t('availability.to')}
          />
        </View>
        <View className="flex-row gap-2">
          <Input
            className="flex-1 font-mono"
            value={hours}
            onChangeText={setHours}
            placeholder={t('availability.hoursPlaceholder')}
            editable={online}
            accessibilityLabel={t('availability.hours')}
          />
          <Input
            className="flex-1"
            value={note}
            onChangeText={setNote}
            maxLength={120}
            placeholder={t('availability.notePlaceholder')}
            editable={online}
            accessibilityLabel={t('availability.note')}
          />
        </View>
        {problem ? (
          <Text className="text-sm text-danger">{problem}</Text>
        ) : startsOn && endsOn ? (
          <Text className="text-sm text-ink-muted">
            {exceptionText(
              {
                id: '',
                starts_on: startsOn,
                ends_on: endsOn,
                starts: trecho?.starts ?? null,
                ends: trecho?.ends ?? null,
                note: note.trim() || null,
              },
              t,
            )}
          </Text>
        ) : null}
        <Button
          variant="ghost"
          className="self-start"
          label={t('availability.addException')}
          disabled={!ready || !online}
          loading={addException.isPending}
          onPress={add}
        />
      </View>
    </View>
  );
}
