import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { NoticeLine } from '@/components/ui/notice-line';
import { useProfile, useToday, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { isReviewDue, reviewSince } from '@/lib/weekly-review';

/**
 * Hoje: sugere a revisão semanal (PB3, D223) quando a última, feita ou dispensada, tem uma
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
    <NoticeLine title={t('review.promptTitle')} body={t('review.promptBody')}>
      <Button label={t('review.start')} onPress={() => router.push('/revisao')} />
      <Button
        variant="ghost"
        label={t('review.notNow')}
        onPress={() => save.mutate({ review: { ...prefs.review, dismissed: today } })}
      />
    </NoticeLine>
  );
}
