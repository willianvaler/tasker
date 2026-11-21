import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useWhen } from '@/components/agenda/public';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatDuration, groupSlots } from '@/lib/booking';
import { formatShortDate } from '@/lib/parser/dates';
import { fetchGroupSlots } from '@/lib/queries/booking';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import { useTimePollActions, type OwnerPoll } from '@/lib/queries/time-poll';
import {
  addSlot,
  localToInstant,
  parseSlotText,
  POLL_MAX_SLOTS,
  POLL_MIN_SLOTS,
} from '@/lib/time-poll';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const DURATIONS = [15, 30, 45, 60, 90];

/**
 * Criar ou mudar uma enquete de horário (AG4, D319): título, duração, recado e de 2 a 5 horários,
 * tocando nos meus horários livres dos próximos 14 dias ou escrevendo um ("25/11 14:00").
 */
export function PollForm({
  poll,
  onSaved,
  onClose,
}: {
  poll?: OwnerPoll;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const tz = useTimeZone();
  const when = useWhen();
  const me = useSession().session?.user.id;
  const { save } = useTimePollActions();
  const [title, setTitle] = useState(poll?.title ?? '');
  const [duration, setDuration] = useState(poll?.duration_min ?? 30);
  const [note, setNote] = useState(poll?.note ?? '');
  const [slots, setSlots] = useState<string[]>(
    () => poll?.slots.map((s) => new Date(s.starts_at).toISOString()) ?? [],
  );
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Sugestões: os meus horários livres (só eu na conta do "achar horário")
  const free = useQuery({
    queryKey: ['time-poll-free', me, duration],
    enabled: !!me,
    queryFn: () => fetchGroupSlots(me ? [me] : [], duration, 14),
    retry: false,
  });
  const days = groupSlots(free.data?.slots ?? [], tz).slice(0, 7);
  const [day, setDay] = useState<string | null>(null);
  const current = days.find((d) => d.date === day) ?? days[0];
  const full = slots.length >= POLL_MAX_SLOTS;
  const has = (iso: string) => slots.some((s) => Date.parse(s) === Date.parse(iso));
  const toggle = (iso: string) =>
    setSlots((list) =>
      list.some((s) => Date.parse(s) === Date.parse(iso))
        ? list.filter((s) => Date.parse(s) !== Date.parse(iso))
        : addSlot(list, new Date(iso).toISOString()),
    );

  function addTyped() {
    const parsed = parseSlotText(typed, today);
    if (!parsed) {
      toast({ message: t('poll.badSlot') });
      return;
    }
    setSlots((list) => addSlot(list, localToInstant(parsed.date, parsed.time, tz)));
    setTyped('');
  }

  const ready = title.trim().length > 0 && slots.length >= POLL_MIN_SLOTS;
  async function submit() {
    if (!ready) return;
    setError(null);
    try {
      const id = await save.mutateAsync({
        id: poll?.id ?? randomUUID(),
        title: title.trim(),
        duration,
        note: note.trim(),
        slots,
      });
      onSaved(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <DialogFrame wide onClose={onClose}>
      <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-4">
        <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
          {poll ? t('poll.edit') : t('poll.new')}
        </Text>
        <Input
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          autoFocus={!poll}
          placeholder={t('poll.titlePlaceholder')}
          accessibilityLabel={t('poll.titleLabel')}
        />
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('poll.duration')}
          </Text>
          <View
            className="flex-row flex-wrap gap-2"
            accessibilityRole="radiogroup"
            aria-label={t('poll.duration')}
          >
            {DURATIONS.map((d) => (
              <Chip
                key={d}
                role="radio"
                label={formatDuration(d)}
                selected={duration === d}
                onPress={() => setDuration(d)}
              />
            ))}
          </View>
        </View>
        <Input
          value={note}
          onChangeText={setNote}
          maxLength={1000}
          multiline
          className="min-h-12 py-2"
          placeholder={t('poll.notePlaceholder')}
          accessibilityLabel={t('poll.noteLabel')}
        />

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('poll.slots', { count: slots.length, max: POLL_MAX_SLOTS })}
          </Text>
          {slots.length === 0 && (
            <Text className="text-sm text-ink-muted">{t('poll.slotsHint')}</Text>
          )}
          {slots.map((iso) => (
            <View key={iso} className="min-h-11 flex-row items-center gap-2 border-b border-line">
              <Text className="flex-1 text-sm text-ink">{when(iso)}</Text>
              <IconButton
                icon={X}
                label={t('poll.removeSlot', { when: when(iso) })}
                onPress={() => toggle(iso)}
              />
            </View>
          ))}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Input
                value={typed}
                onChangeText={setTyped}
                placeholder={t('poll.typePlaceholder')}
                accessibilityLabel={t('poll.typeLabel')}
                submitBehavior="submit"
                onSubmitEditing={addTyped}
                editable={!full}
              />
            </View>
            <Button
              variant="ghost"
              label={t('poll.addSlot')}
              disabled={full || !typed.trim()}
              onPress={addTyped}
            />
          </View>
        </View>

        {days.length > 0 && current && (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-ink">{t('poll.suggestions')}</Text>
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              aria-label={t('poll.suggestions')}
            >
              {days.map((d) => (
                <Chip
                  key={d.date}
                  role="radio"
                  label={formatShortDate(d.date)}
                  selected={d.date === current.date}
                  onPress={() => setDay(d.date)}
                />
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2">
              {current.slots.slice(0, 24).map((s) => (
                <Chip
                  key={s.iso}
                  role="checkbox"
                  label={s.time}
                  selected={has(s.iso)}
                  disabled={full && !has(s.iso)}
                  onPress={() => toggle(s.iso)}
                />
              ))}
            </View>
          </View>
        )}

        {error && (
          <Text accessibilityRole="alert" className="text-sm text-danger">
            {error}
          </Text>
        )}
        <View className="flex-row flex-wrap gap-2">
          <Button label={t('common.save')} disabled={!ready || save.isPending} onPress={submit} />
          <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        </View>
      </ScrollView>
    </DialogFrame>
  );
}
