import { useLocalSearchParams } from 'expo-router';
import { Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { gamificationConfig } from '@/lib/gamification.config';
import { useCards, useReviewCard, type StudyCard } from '@/lib/queries/cards';
import { useGameLevel } from '@/lib/queries/game';
import { useToday, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import {
  GRADES,
  nextInterval,
  readSrsLimits,
  SRS_LIMIT_MAX,
  srsQueue,
  studySessions,
} from '@/lib/srs';
import { uuidv7 } from '@/lib/uuid';
import { useToast } from '@/providers/toast';

// Revisar cartões (ET1, D386): a sessão do dia com os vencidos e os novos dentro dos limites.
// Errou? O cartão volta no fim da sessão. Funciona sem internet. Em Mais, no Ctrl+K e no ⋯ da
// anotação (só os cartões dela).
export default function CardsScreen() {
  const { t } = useTranslation();
  const { nota } = useLocalSearchParams<{ nota?: string }>();
  const noteId = typeof nota === 'string' && nota ? nota : null;
  const today = useToday();
  const cards = useCards(noteId);
  const limits = readSrsLimits(useUiPrefs().srs);
  const updatePrefs = useUpdateUiPrefs();
  const review = useReviewCard();
  const toast = useToast();
  const [settings, setSettings] = useState(false);
  // A sessão é tirada uma vez da fila (os ids); o que muda no cache não embaralha a ordem
  const [session, setSession] = useState<{ ids: string[]; at: number; shown: boolean } | null>(
    null,
  );
  const [done, setDone] = useState(0);
  const gameOn = useGameLevel() !== 'off';
  const { studySessionCards: size, studyDailyCap: cap } = gamificationConfig.antiFarm;

  const data = cards.data;
  const queue = data ? srsQueue(data.cards, data.reviews, today, limits) : null;
  const left = queue ? queue.due.length + queue.fresh.length : 0;
  if (data && queue && !session && left > 0) {
    setSession({ ids: [...queue.due, ...queue.fresh].map((c) => c.id), at: 0, shown: false });
  }

  const byId: Record<string, StudyCard> = {};
  for (const c of data?.cards ?? []) byId[c.id] = c;
  const currentId = session && session.at < session.ids.length ? session.ids[session.at] : null;
  const current = currentId ? byId[currentId] : undefined;
  const reviewsOf = (id: string) => (data?.reviews ?? []).filter((r) => r.card_id === id);
  const remaining = session ? session.ids.length - session.at : left;

  const answer = (grade: number) => {
    if (!current || !session) return;
    review.mutate(
      {
        id: uuidv7(),
        card_id: current.id,
        grade,
        day: today,
        reviewed_at: new Date().toISOString(),
      },
      { onError: (e: Error) => toast({ message: e.message }) },
    );
    setDone((n) => n + 1);
    setSession({
      // Errou: volta no fim da sessão
      ids: grade < 3 ? [...session.ids, current.id] : session.ids,
      at: session.at + 1,
      shown: false,
    });
  };

  const days = (n: number) => t('cards.days', { count: n });
  // ET2: a sessão de estudo vale XP pelo servidor; aqui só mostra quanto falta
  const study = data && gameOn ? studySessions(data.reviews, today, size, cap) : null;

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          back
          help="estudo-cartoes"
          title={t('cards.title')}
          eyebrow={data ? t('cards.todayCount', { count: remaining }) : undefined}
          right={
            <IconButton
              icon={Settings2}
              label={t('cards.limits')}
              onPress={() => setSettings(true)}
            />
          }
        />
        {data && data.cards.length === 0 ? (
          <View className={`gap-2 ${READABLE}`}>
            <Text className="text-base text-ink">{t('cards.empty')}</Text>
            <Text className="font-mono text-sm text-ink-muted">{t('cards.syntax')}</Text>
          </View>
        ) : current ? (
          <View
            className={`gap-4 rounded border border-line p-4 ${READABLE}`}
            accessibilityLabel={t('cards.card')}
          >
            {!!current.note_title && (
              <Text className="text-xs uppercase text-ink-muted">{current.note_title}</Text>
            )}
            <Text className="font-serif text-xl text-ink">{current.question}</Text>
            {session?.shown ? (
              <>
                <View className="border-t border-line pt-4">
                  <Text className="text-base text-ink" accessibilityLabel={t('cards.answer')}>
                    {current.answer}
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {GRADES.map(({ grade, key }) => {
                    const label = t(`cards.grade.${key}`);
                    const next = days(nextInterval(reviewsOf(current.id), grade, today));
                    return (
                      <Button
                        key={key}
                        variant={key === 'good' ? 'primary' : 'ghost'}
                        label={`${label} · ${next}`}
                        accessibilityLabel={`${label}, ${next}`}
                        onPress={() => answer(grade)}
                      />
                    );
                  })}
                </View>
              </>
            ) : (
              <View className="flex-row">
                <Button
                  label={t('cards.show')}
                  onPress={() => session && setSession({ ...session, shown: true })}
                />
              </View>
            )}
          </View>
        ) : data ? (
          <View className={`gap-2 ${READABLE}`}>
            <Text className="font-serif text-xl text-ink">
              {done > 0 ? t('cards.finished', { count: done }) : t('cards.nothing')}
            </Text>
            {queue &&
              (queue.dueTotal > queue.due.length || queue.freshTotal > queue.fresh.length) && (
                <Text className="text-sm text-ink-muted">
                  {t('cards.limitReached', {
                    due: queue.dueTotal - queue.due.length,
                    fresh: queue.freshTotal - queue.fresh.length,
                  })}
                </Text>
              )}
          </View>
        ) : null}

        {study && data && data.cards.length > 0 && (
          <Text className={`text-sm text-ink-muted ${READABLE}`}>
            {study.capped
              ? t('cards.studyCapped', { count: cap })
              : t('cards.studyProgress', {
                  done: study.inSession,
                  size,
                  xp: gamificationConfig.xp.study,
                })}
          </Text>
        )}

        {settings && (
          <PromptDialog
            title={t('cards.limits')}
            message={t('cards.limitsHint')}
            fields={[
              {
                key: 'fresh',
                placeholder: t('cards.newPerDay'),
                initial: String(limits.newPerDay),
                maxLength: 4,
              },
              {
                key: 'reviews',
                placeholder: t('cards.reviewsPerDay'),
                initial: String(limits.reviewsPerDay),
                maxLength: 4,
              },
            ]}
            validate={(v) => limitOf(v.fresh) !== null && limitOf(v.reviews) !== null}
            onClose={() => setSettings(false)}
            onConfirm={(v) => {
              setSettings(false);
              const newPerDay = limitOf(v.fresh);
              const reviewsPerDay = limitOf(v.reviews);
              if (newPerDay === null || reviewsPerDay === null) return;
              updatePrefs.mutate({ srs: { newPerDay, reviewsPerDay } });
              setSession(null);
            }}
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}

function limitOf(text: string): number | null {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 0 && n <= SRS_LIMIT_MAX ? n : null;
}
