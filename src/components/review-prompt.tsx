import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useProfile, useToday, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { isReviewDue, reviewSince } from '@/lib/weekly-review';

/**
 * Início: sugere a revisão semanal (PB3, D223) quando a última, feita ou dispensada, tem uma
 * semana. Conta nova (menos de uma semana desde a introdução) ainda não vê.
 */
export function ReviewPrompt() {
  const { t } = useTranslation();
  const today = useToday();
  const profile = useProfile().data;
  const prefs = useUiPrefs();
  const save = useUpdateUiPrefs();
  const onboarded = profile?.onboarded_at?.slice(0, 10);
  if (!onboarded || onboarded > reviewSince(today) || profile?.gym_enabled == null) return null;
  if (!isReviewDue(prefs.review, today)) return null;
  return (
    <View className="mt-4 gap-3 rounded-lg border border-line bg-surface p-4">
      <View className="gap-1">
        <Text className="text-base font-semibold text-ink">{t('review.promptTitle')}</Text>
        <Text className="text-sm text-ink-muted">{t('review.promptBody')}</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button label={t('review.start')} onPress={() => router.push('/revisao')} />
        <Button
          variant="ghost"
          label={t('review.notNow')}
          onPress={() => save.mutate({ review: { ...prefs.review, dismissed: today } })}
        />
      </View>
    </View>
  );
}
