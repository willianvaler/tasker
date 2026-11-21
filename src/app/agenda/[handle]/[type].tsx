import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BookingSummary,
  PublicShell,
  SlotPicker,
  deviceTimeZone,
  useWhen,
} from '@/components/agenda/public';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatDuration, groupSlots } from '@/lib/booking';
import { addDays, todayIn } from '@/lib/parser/dates';
import {
  bookSlot,
  fetchBookingSlots,
  rescheduleBooking,
  type BookResult,
} from '@/lib/queries/booking';

const SPAN = 14;

/**
 * Página pública de um tipo de compromisso (AG2, D311), FORA do login: os horários livres da
 * pessoa (só livre, nunca o que ocupa), no fuso de quem abre, e o formulário de reserva. Com
 * `?remarcar=<token>`, a mesma tela troca o horário de uma reserva.
 */
export default function BookingTypeScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const when = useWhen();
  const { handle, type, remarcar } = useLocalSearchParams<{
    handle: string;
    type: string;
    remarcar?: string;
  }>();
  const today = todayIn(deviceTimeZone());
  const [page, setPage] = useState(0);
  const from = addDays(today, page * SPAN);
  const to = addDays(from, SPAN - 1);
  const slots = useQuery({
    queryKey: ['booking-slots', handle, type, from, remarcar ?? null],
    queryFn: () => fetchBookingSlots(handle, type, from, to, remarcar),
    retry: false,
  });
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: BookResult & { status: 'ok' }; token: string } | null>(
    null,
  );

  const data = slots.data;
  if (done)
    return (
      <PublicShell title={done.result.booking.type_name}>
        <BookingSummary booking={done.result.booking} token={done.token} />
      </PublicShell>
    );
  if (slots.isPending)
    return (
      <PublicShell title="Questlist">
        <Text className="text-ink-muted">{t('booking.loading')}</Text>
      </PublicShell>
    );
  if (slots.error || !data || data.status !== 'ok')
    return (
      <PublicShell title="Questlist">
        <Text className="font-serif text-xl text-ink">
          {slots.error ? t('booking.error') : t('booking.missing')}
        </Text>
      </PublicShell>
    );

  const kind = data.type;
  const days = groupSlots(data.slots, deviceTimeZone());
  const lastPage = addDays(today, kind.max_days) <= to;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready =
    !!slot &&
    (remarcar ||
      (name.trim() &&
        emailOk &&
        (kind.ask_phone !== 'required' || phone.trim()) &&
        (kind.ask_note !== 'required' || note.trim())));

  async function submit() {
    if (!slot) return;
    setSending(true);
    setProblem(null);
    try {
      const result = remarcar
        ? await rescheduleBooking(remarcar, slot)
        : await bookSlot({
            handle,
            slug: type,
            starts: slot,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            note: note.trim(),
          });
      if (result.status === 'ok') {
        setDone({ result, token: remarcar ?? result.token ?? '' });
        return;
      }
      setProblem(t(`booking.problem.${result.status}`));
      if (result.status === 'taken') {
        setSlot(null);
        void queryClient.invalidateQueries({ queryKey: ['booking-slots'] });
      }
    } catch (e) {
      setProblem(t('booking.sendError', { message: (e as Error).message }));
    } finally {
      setSending(false);
    }
  }

  return (
    <PublicShell title={`${kind.name} · ${data.owner}`}>
      <View className="gap-1">
        <Text className="text-sm text-ink-muted">
          {remarcar ? t('booking.rescheduleWith', { name: data.owner }) : data.owner}
        </Text>
        <Text accessibilityRole="header" className="text-xl font-serif text-ink">
          {kind.name}
        </Text>
        <Text className="text-ink-muted">
          {formatDuration(kind.duration_min)}
          {kind.needs_approval ? ` · ${t('booking.needsApproval')}` : ''}
        </Text>
        {kind.description ? <Text className="pt-2 text-ink">{kind.description}</Text> : null}
        <Button
          variant="ghost"
          className="self-start"
          label={t('booking.otherTypes', { name: data.owner })}
          onPress={() => router.push(`/agenda/${data.username}`)}
        />
      </View>

      <View className="gap-3">
        <Text className="text-sm text-ink-muted">
          {t('booking.inYourZone', { zone: deviceTimeZone() })}
        </Text>
        {days.length ? (
          <SlotPicker
            days={days}
            day={day}
            slot={slot}
            onDay={(d) => {
              setDay(d);
              setSlot(null);
            }}
            onSlot={setSlot}
          />
        ) : (
          <Text className="text-ink">{t('booking.noSlots')}</Text>
        )}
        <View className="flex-row gap-2">
          <Button
            variant="ghost"
            icon={ChevronLeft}
            label={t('booking.earlier')}
            disabled={page === 0}
            onPress={() => {
              setPage(page - 1);
              setDay(null);
              setSlot(null);
            }}
          />
          <Button
            variant="ghost"
            icon={ChevronRight}
            label={t('booking.later')}
            disabled={lastPage}
            onPress={() => {
              setPage(page + 1);
              setDay(null);
              setSlot(null);
            }}
          />
        </View>
      </View>

      {slot && (
        <View className="gap-3 border-t border-line pt-4">
          <Text className="font-semibold text-ink">{when(slot)}</Text>
          {!remarcar && (
            <>
              <Input
                value={name}
                onChangeText={setName}
                maxLength={80}
                autoComplete="name"
                placeholder={t('booking.name')}
                accessibilityLabel={t('booking.name')}
              />
              <Input
                value={email}
                onChangeText={setEmail}
                maxLength={254}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder={t('booking.email')}
                accessibilityLabel={t('booking.email')}
              />
              {kind.ask_phone !== 'off' && (
                <Input
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={40}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  placeholder={t(
                    kind.ask_phone === 'required' ? 'booking.phone' : 'booking.phoneOptional',
                  )}
                  accessibilityLabel={t(
                    kind.ask_phone === 'required' ? 'booking.phone' : 'booking.phoneOptional',
                  )}
                />
              )}
              {kind.ask_note !== 'off' && (
                <Input
                  value={note}
                  onChangeText={setNote}
                  maxLength={1000}
                  multiline
                  className="min-h-20"
                  placeholder={t(
                    kind.ask_note === 'required' ? 'booking.note' : 'booking.noteOptional',
                  )}
                  accessibilityLabel={t(
                    kind.ask_note === 'required' ? 'booking.note' : 'booking.noteOptional',
                  )}
                />
              )}
              <Text className="text-xs text-ink-muted">{t('booking.privacy')}</Text>
            </>
          )}
          {problem && (
            <Text accessibilityRole="alert" className="text-sm text-danger">
              {problem}
            </Text>
          )}
          <Button
            className="self-start"
            label={remarcar ? t('booking.confirmReschedule') : t('booking.confirm')}
            disabled={!ready}
            loading={sending}
            onPress={submit}
          />
        </View>
      )}
    </PublicShell>
  );
}
