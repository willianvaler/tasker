import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import {
  CalendarOff,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Copy,
  Dumbbell,
  RefreshCw,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, useWindowDimensions, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import {
  calendarDays,
  monthGrid,
  monthOf,
  shiftMonth,
  weekOf,
  type CalendarEntry,
  type CalendarPage,
} from '@/lib/calendar';
import { cn } from '@/lib/cn';
import {
  addDays,
  dateLocale,
  formatDueDate,
  formatMonthYear,
  formatShortDate,
  weekdayOf,
  weekdayShort,
} from '@/lib/parser/dates';
import {
  feedUrl,
  googleCalendarUrl,
  useCalendarFeed,
  useCalendarFeedActions,
  useCalendarTasks,
} from '@/lib/queries/calendar';
import { useToday } from '@/lib/queries/profile';
import { isWorkoutPage, pageLabel, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

type CalendarView = 'month' | 'week';

/** Quantos itens cabem numa célula do mês (o resto vira "+N"). */
const CELL_ITEMS = 3;

// Calendário (C1): as tarefas com data de todas as pastas e projetos, por mês ou semana. Página de
// treino aparece uma vez por dia e abre a página. Embaixo, o link para assinar no Google Agenda.
export default function CalendarScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const tree = useTree();
  const { width } = useWindowDimensions();
  const compact = width < 768;
  // Domingo primeiro, como nos calendários do Brasil e dos EUA; em espanhol, segunda
  const weekStart = dateLocale() === 'es' ? 1 : 0;
  const [view, setView] = useState<CalendarView>('month');
  const [selected, setSelected] = useState(today);

  const month = monthOf(selected);
  const weeks = view === 'month' ? monthGrid(month, weekStart) : [weekOf(selected, weekStart)];
  const from = weeks[0][0];
  const to = weeks[weeks.length - 1][6];
  const tasks = useCalendarTasks(from, to);

  const pages: Record<string, CalendarPage> = {};
  for (const page of tree.data?.pages ?? [])
    pages[page.id] = {
      name: pageLabel(page),
      workout: isWorkoutPage(tree.data, page),
      habits: page.view_type === 'habits',
    };
  const days = calendarDays(tasks.data ?? [], pages, from, to);

  const move = (delta: number) =>
    setSelected(view === 'month' ? `${shiftMonth(month, delta)}-01` : addDays(selected, 7 * delta));
  const label =
    view === 'month' ? formatMonthYear(month) : `${formatShortDate(from)} – ${formatShortDate(to)}`;
  const title = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <Screen size="wide">
      <ScreenHeader title={t('calendar.title')} help="calendario" back />
      <ScreenScroll contentContainerClassName="gap-4 pb-12">
        <Tabs
          label={t('calendar.view')}
          value={view}
          onChange={setView}
          tabs={[
            { value: 'month', label: t('calendar.month') },
            { value: 'week', label: t('calendar.week') },
          ]}
        />
        <View className="flex-row items-center gap-1">
          <IconButton icon={ChevronLeft} label={t('calendar.previous')} onPress={() => move(-1)} />
          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 text-center text-base font-semibold text-ink"
          >
            {title}
          </Text>
          <IconButton icon={ChevronRight} label={t('calendar.next')} onPress={() => move(1)} />
          <Button
            variant="ghost"
            label={t('calendar.today')}
            disabled={selected === today}
            onPress={() => setSelected(today)}
          />
        </View>

        {view === 'month' ? (
          <>
            <MonthGrid
              weeks={weeks}
              month={month}
              today={today}
              selected={selected}
              days={days}
              compact={compact}
              weekStart={weekStart}
              onSelect={setSelected}
            />
            <DayList date={selected} today={today} entries={days[selected] ?? []} pages={pages} />
          </>
        ) : (
          weeks[0].map((date) => (
            <DayList
              key={date}
              date={date}
              today={today}
              entries={days[date] ?? []}
              pages={pages}
            />
          ))
        )}

        <FeedSection />
      </ScreenScroll>
    </Screen>
  );
}

function MonthGrid({
  weeks,
  month,
  today,
  selected,
  days,
  compact,
  weekStart,
  onSelect,
}: {
  weeks: string[][];
  month: string;
  today: string;
  selected: string;
  days: Record<string, CalendarEntry[]>;
  compact: boolean;
  weekStart: 0 | 1;
  onSelect: (date: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View role="grid" aria-label={formatMonthYear(month)}>
      <View className="flex-row border-b border-line">
        {weeks[0].map((date) => (
          <Text
            key={date}
            className="flex-1 pb-1 text-center font-mono text-xs uppercase text-ink-muted"
          >
            {weekdayShort(weekdayOf(date))}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} className="flex-row" role="row">
          {week.map((date) => {
            const entries = days[date] ?? [];
            const outside = monthOf(date) !== month;
            const isSelected = date === selected;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                aria-selected={isSelected}
                accessibilityLabel={
                  entries.length
                    ? t('calendar.dayWithItems', {
                        date: formatShortDate(date),
                        count: entries.length,
                      })
                    : formatShortDate(date)
                }
                onPress={() => onSelect(date)}
                className={cn(
                  'min-w-0 flex-1 gap-1 border-b border-r border-line p-1 hover:bg-wash',
                  compact ? 'min-h-14' : 'min-h-24',
                  date === week[0] && 'border-l',
                  isSelected && 'bg-accent-soft hover:bg-accent-soft',
                )}
              >
                <View
                  className={cn(
                    'h-6 w-6 items-center justify-center self-center rounded-full md:self-start',
                    date === today && 'bg-accent',
                  )}
                >
                  <Text
                    className={cn(
                      'font-mono text-xs',
                      date === today ? 'text-on-accent' : outside ? 'text-ink-muted' : 'text-ink',
                    )}
                  >
                    {Number(date.slice(8))}
                  </Text>
                </View>
                {compact ? (
                  // Celular: só pontinhos, a lista do dia fica embaixo
                  <View className="flex-row flex-wrap justify-center gap-1">
                    {entries.slice(0, CELL_ITEMS).map((e) => (
                      <View
                        key={e.id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          e.kind === 'workout' ? 'bg-accent' : 'bg-ink-muted',
                        )}
                      />
                    ))}
                  </View>
                ) : (
                  <>
                    {entries.slice(0, CELL_ITEMS).map((e) => (
                      <Text
                        key={e.id}
                        numberOfLines={1}
                        className={cn(
                          'rounded px-1 text-xs',
                          e.kind === 'workout'
                            ? 'bg-accent text-on-accent'
                            : e.done
                              ? 'text-ink-muted line-through'
                              : 'text-ink',
                        )}
                      >
                        {e.kind === 'task' && e.time ? `${e.time} ${e.title}` : e.title}
                      </Text>
                    ))}
                    {entries.length > CELL_ITEMS && (
                      <Text className="px-1 font-mono text-xs text-ink-muted">
                        {t('calendar.more', { count: entries.length - CELL_ITEMS })}
                      </Text>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayList({
  date,
  today,
  entries,
  pages,
}: {
  date: string;
  today: string;
  entries: CalendarEntry[];
  pages: Record<string, CalendarPage>;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <SectionLabel
        title={formatDueDate(date, today)}
        count={entries.length || undefined}
        className="pt-2"
      />
      {entries.length === 0 ? (
        <Text className="py-2 text-sm text-ink-muted">{t('calendar.empty')}</Text>
      ) : (
        entries.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="link"
            onPress={() =>
              e.kind === 'workout'
                ? router.push({ pathname: '/page/[id]', params: { id: e.pageId } })
                : router.push({ pathname: '/task/[id]', params: { id: e.id } })
            }
            className="min-h-11 flex-row items-center gap-3 rounded px-1 hover:bg-wash active:bg-wash md:min-h-9"
          >
            <Icon
              icon={e.kind === 'workout' ? Dumbbell : e.done ? CircleCheck : Circle}
              tone={e.kind === 'workout' ? 'accent' : 'ink-muted'}
            />
            <Text
              numberOfLines={1}
              className={cn(
                'min-w-0 flex-1 text-sm',
                e.kind === 'task' && e.done ? 'text-ink-muted line-through' : 'text-ink',
              )}
            >
              {e.kind === 'task' && e.time ? `${e.time} · ${e.title}` : e.title}
            </Text>
            <Text numberOfLines={1} className="max-w-[40%] font-mono text-xs text-ink-muted">
              {e.kind === 'workout'
                ? t('calendar.exercises', { count: e.count })
                : (pages[e.pageId]?.name ?? '')}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

/** Link secreto do feed .ics para assinar no Google Agenda (ou Apple, Outlook). */
function FeedSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const feed = useCalendarFeed();
  const { link, off } = useCalendarFeedActions();
  const [confirm, setConfirm] = useState<'rotate' | 'off' | null>(null);
  const url = feed.data ? feedUrl(feed.data) : null;
  const onError = (err: Error) =>
    toast({ message: t('calendar.feedError', { message: err.message }) });

  async function copy() {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    toast({ message: t('calendar.feedCopied') });
  }

  return (
    <View className="gap-3">
      <SectionLabel title={t('calendar.feedTitle')} />
      <Text className="text-sm text-ink-muted">{t('calendar.feedIntro')}</Text>
      {!online && <Text className="text-sm text-warn">{t('calendar.feedOffline')}</Text>}
      {url ? (
        <>
          <Text
            selectable
            accessibilityLabel={t('calendar.feedLink')}
            className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
          >
            {url}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              icon={CalendarPlus}
              label={t('calendar.feedGoogle')}
              onPress={() => void Linking.openURL(googleCalendarUrl(url))}
            />
            <Button
              variant="ghost"
              icon={Copy}
              label={t('calendar.feedCopy')}
              onPress={() => void copy()}
            />
            <Button
              variant="ghost"
              icon={RefreshCw}
              label={t('calendar.feedRotate')}
              disabled={!online}
              onPress={() => setConfirm('rotate')}
            />
            <Button
              variant="ghost"
              icon={CalendarOff}
              label={t('calendar.feedOff')}
              disabled={!online}
              onPress={() => setConfirm('off')}
            />
          </View>
          <Text className="text-xs text-ink-muted">{t('calendar.feedHow')}</Text>
          <Text className="text-xs text-ink-muted">{t('calendar.feedPrivate')}</Text>
        </>
      ) : (
        <Button
          icon={CalendarPlus}
          className="self-start"
          label={t('calendar.feedOn')}
          loading={link.isPending}
          disabled={!online || feed.isPending}
          onPress={() => link.mutate(false, { onError })}
        />
      )}
      {confirm === 'rotate' && (
        <ConfirmDialog
          title={t('calendar.feedRotateTitle')}
          message={t('calendar.feedRotateMessage')}
          confirmLabel={t('calendar.feedRotate')}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            link.mutate(true, {
              onError,
              onSuccess: () => toast({ message: t('calendar.feedRotated') }),
            });
          }}
        />
      )}
      {confirm === 'off' && (
        <ConfirmDialog
          title={t('calendar.feedOffTitle')}
          message={t('calendar.feedOffMessage')}
          confirmLabel={t('calendar.feedOff')}
          destructive
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            off.mutate(undefined, { onError });
          }}
        />
      )}
    </View>
  );
}
