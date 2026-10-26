import { router } from 'expo-router';
import { KeyRound, Plus, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HubRow } from '@/components/hub';
import { Button } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { challengeProgress } from '@/lib/gym/leaderboard';
import { useMyChallenges, type MyChallenge } from '@/lib/queries/challenges';
import { useToday } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';

/** Quantos dos que acabaram aparecem (o resto fica no histórico de cada grupo) */
const PAST = 3;

/**
 * Bloco Desafios (AC15C), abaixo da Academia: os desafios de que a pessoa faz parte, "+" para criar
 * e entrar com o código que alguém mandou.
 */
export function ChallengesBlock() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const today = useToday();
  const mine = useMyChallenges();
  const [joining, setJoining] = useState(false);
  const all = mine.data ?? [];
  const running = all.filter((c) => !c.finished_at && c.ends_on >= today);
  const past = all.filter((c) => !running.includes(c)).slice(0, PAST);

  const hint = (c: MyChallenge) => {
    const progress = challengeProgress({ start: c.starts_on, end: c.ends_on, today });
    return [
      progress.left > 0
        ? t('group.dayOf', { day: progress.elapsed, total: progress.total })
        : t('group.finished'),
      t('challenge.members', { count: c.members }),
      t(`challenge.scoring.${c.scoring}`),
    ].join(' · ');
  };

  return (
    <View>
      <SectionLabel
        title={t('challenge.section')}
        count={running.length || undefined}
        right={
          <View className="flex-row">
            <Button
              variant="ghost"
              icon={KeyRound}
              label={t('challenge.joinCode')}
              disabled={!online}
              onPress={() => setJoining(true)}
            />
            <Button
              variant="ghost"
              icon={Plus}
              label={t('challenge.new')}
              disabled={!online}
              onPress={() => router.push('/desafio/novo')}
            />
          </View>
        }
      />
      {mine.data && all.length === 0 && (
        <View className="gap-1 px-2 py-2">
          <Text className="text-sm text-ink">{t('challenge.none')}</Text>
          <Text className="text-xs text-ink-muted">{t('challenge.noneHint')}</Text>
        </View>
      )}
      {[...running, ...past].map((c) => (
        <HubRow
          key={c.id}
          icon={Trophy}
          label={c.name}
          hint={hint(c)}
          href={{ pathname: '/desafio/[id]', params: { id: c.id } }}
        />
      ))}
      {joining && (
        <PromptDialog
          title={t('challenge.joinCode')}
          confirmLabel={t('challenge.join.submit')}
          fields={[{ key: 'code', placeholder: t('challenge.codePlaceholder'), initial: '' }]}
          onClose={() => setJoining(false)}
          onConfirm={({ code }) => {
            const clean = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
            if (!clean) return;
            setJoining(false);
            router.push({ pathname: '/desafio-entrar/[code]', params: { code: clean } });
          }}
        />
      )}
    </View>
  );
}
