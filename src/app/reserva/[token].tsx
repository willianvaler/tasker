import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BookingSummary, PublicShell } from '@/components/agenda/public';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { cancelBooking, fetchBookingByToken } from '@/lib/queries/booking';

/**
 * Reserva aberta pelo link de quem reservou (AG2, D311), FORA do login: ver, remarcar (volta à
 * página do tipo com `?remarcar=`) ou cancelar. O token é a chave: quem tem o link mexe.
 */
export default function BookingManageScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { token } = useLocalSearchParams<{ token: string }>();
  const key = ['booking-token', token];
  const booking = useQuery({
    queryKey: key,
    queryFn: () => fetchBookingByToken(token),
    retry: false,
  });
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const data = booking.data;
  if (booking.isPending)
    return (
      <PublicShell title="Questlist">
        <Text className="text-ink-muted">{t('booking.loading')}</Text>
      </PublicShell>
    );
  if (!data || data.status !== 'ok')
    return (
      <PublicShell title="Questlist">
        <Text className="font-serif text-xl text-ink">
          {booking.error ? t('booking.error') : t('booking.missingBooking')}
        </Text>
      </PublicShell>
    );
  const b = data.booking;
  return (
    <PublicShell title={b.type_name}>
      <BookingSummary booking={b} token={token}>
        {b.can_change && (
          <View className="flex-row flex-wrap gap-2">
            {b.type_slug && (
              <Button
                label={t('booking.reschedule')}
                onPress={() =>
                  router.push({
                    pathname: '/agenda/[handle]/[type]',
                    params: { handle: b.username, type: b.type_slug ?? '', remarcar: token },
                  })
                }
              />
            )}
            <Button
              variant="ghost"
              destructive
              label={t('booking.cancel')}
              onPress={() => setAsking(true)}
            />
          </View>
        )}
        {problem && (
          <Text accessibilityRole="alert" className="text-sm text-danger">
            {problem}
          </Text>
        )}
      </BookingSummary>
      {asking && (
        <ConfirmDialog
          title={t('booking.cancelTitle')}
          message={t('booking.cancelMessage', { name: b.owner })}
          confirmLabel={t('booking.cancel')}
          destructive
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            setAsking(false);
            try {
              const result = await cancelBooking(token);
              if (result.status === 'ok') queryClient.setQueryData(key, result);
              else setProblem(t(`booking.problem.${result.status}`));
            } catch (e) {
              setProblem(t('booking.sendError', { message: (e as Error).message }));
            }
          }}
        />
      )}
    </PublicShell>
  );
}
