import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { PublicShell } from '@/components/agenda/public';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/booking';
import { fetchBookingProfile } from '@/lib/queries/booking';

/** Agenda pública de uma pessoa (AG2, D311), FORA do login: os tipos de compromisso ativos. */
export default function BookingProfileScreen() {
  const { t } = useTranslation();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const profile = useQuery({
    queryKey: ['booking-profile', handle],
    queryFn: () => fetchBookingProfile(handle),
    retry: false,
  });
  const data = profile.data;
  if (profile.isPending)
    return (
      <PublicShell title="Questlist">
        <Text className="text-ink-muted">{t('booking.loading')}</Text>
      </PublicShell>
    );
  if (!data || data.status !== 'ok')
    return (
      <PublicShell title="Questlist">
        <Text className="font-serif text-xl text-ink">
          {profile.error ? t('booking.error') : t('booking.missing')}
        </Text>
      </PublicShell>
    );
  return (
    <PublicShell title={t('booking.agendaOf', { name: data.name })}>
      <Text accessibilityRole="header" className="text-xl font-serif text-ink">
        {t('booking.agendaOf', { name: data.name })}
      </Text>
      {data.types.length === 0 ? (
        <Text className="text-ink">{t('booking.noTypes')}</Text>
      ) : (
        <View className="gap-2">
          <Text className="text-ink-muted">{t('booking.pickType')}</Text>
          {data.types.map((type) => (
            <Pressable
              key={type.slug}
              accessibilityRole="link"
              accessibilityLabel={`${type.name} · ${formatDuration(type.duration_min)}`}
              onPress={() => router.push(`/agenda/${data.username}/${type.slug}`)}
              className="gap-1 rounded border border-line p-4 hover:bg-wash"
            >
              <Text className="font-semibold text-ink">{type.name}</Text>
              <Text className="text-sm text-ink-muted">{formatDuration(type.duration_min)}</Text>
              {type.description ? (
                <Text className="text-sm text-ink" numberOfLines={3}>
                  {type.description}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </PublicShell>
  );
}
