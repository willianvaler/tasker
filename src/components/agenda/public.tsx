import { Stack } from 'expo-router';
import { CalendarPlus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { bookingIcs, type SlotDay } from '@/lib/booking';
import { saveTextFile } from '@/lib/download';
import { formatShortDate } from '@/lib/parser/dates';
import type { PublicBooking } from '@/lib/queries/booking';
import { webUrl } from '@/lib/queries/projects';

// Peças das páginas públicas da agenda (AG2, D311): fora do login, no fuso de quem abre.

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-6 px-4 py-8 md:px-8"
      >
        {children}
        <Text className="border-t border-line pt-4 text-xs text-ink-muted">
          {t('booking.made')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** "segunda-feira, 23 de novembro de 2026, 09:00" no idioma e no fuso de quem vê */
export function useWhen() {
  const { i18n } = useTranslation();
  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeStyle: 'short' });
  return (iso: string) => format.format(new Date(iso));
}

/** Dias com horário livre e, no dia escolhido, os horários. */
export function SlotPicker({
  days,
  day,
  slot,
  onDay,
  onSlot,
}: {
  days: SlotDay[];
  day: string | null;
  slot: string | null;
  onDay: (date: string) => void;
  onSlot: (iso: string) => void;
}) {
  const { t } = useTranslation();
  const current = days.find((d) => d.date === day) ?? days[0];
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-ink">{t('booking.pickDay')}</Text>
        <View
          role="radiogroup"
          aria-label={t('booking.pickDay')}
          className="flex-row flex-wrap gap-2"
        >
          {days.map((d) => (
            <Chip
              key={d.date}
              role="radio"
              label={formatShortDate(d.date)}
              selected={d.date === current?.date}
              onPress={() => onDay(d.date)}
            />
          ))}
        </View>
      </View>
      {current && (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-ink">
            {t('booking.pickTime', { day: formatShortDate(current.date) })}
          </Text>
          <View
            role="radiogroup"
            aria-label={t('booking.pickTime', { day: formatShortDate(current.date) })}
            className="flex-row flex-wrap gap-2"
          >
            {current.slots.map((s) => (
              <Chip
                key={s.iso}
                role="radio"
                label={s.time}
                selected={s.iso === slot}
                onPress={() => onSlot(s.iso)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** Reserva feita (ou aberta pelo link): quando, estado, .ics e o link de remarcar/cancelar. */
export function BookingSummary({
  booking,
  token,
  children,
}: {
  booking: PublicBooking;
  token: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const when = useWhen();
  const manage = webUrl(`/reserva/${token}`);
  const active = booking.status === 'pending' || booking.status === 'confirmed';
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">
          {t(`booking.status.${booking.status}`, { name: booking.owner })}
        </Text>
        <Text className="text-ink">
          {booking.type_name} · {booking.owner}
        </Text>
        <Text className="text-ink">{when(booking.starts_at)}</Text>
        <Text className="text-sm text-ink-muted">
          {t('booking.inYourZone', { zone: deviceTimeZone() })}
        </Text>
        {booking.status === 'cancelled' && booking.cancelled_by === 'owner' && (
          <Text className="text-sm text-ink-muted">{t('booking.cancelledByOwner')}</Text>
        )}
      </View>
      {active && (
        <View className="gap-2">
          <Button
            variant="ghost"
            icon={CalendarPlus}
            className="self-start"
            label={t('booking.addToCalendar')}
            onPress={() =>
              saveTextFile(
                'compromisso.ics',
                bookingIcs({
                  uid: token,
                  starts_at: booking.starts_at,
                  ends_at: booking.ends_at,
                  title: `${booking.type_name} · ${booking.owner}`,
                  description: t('booking.icsDescription', { link: manage }),
                  url: manage,
                }),
                'text/calendar',
              )
            }
          />
          <Text className="text-sm text-ink-muted">{t('booking.keepLink')}</Text>
          <Text
            selectable
            className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
          >
            {manage}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}
