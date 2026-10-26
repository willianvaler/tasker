import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PeoplePicker } from '@/components/group/challenge-people';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { SCORINGS, type Scoring } from '@/lib/gym/leaderboard';
import { useChallengeMutations } from '@/lib/queries/challenges';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/**
 * Novo desafio (AC15C, "+" no bloco Desafios): nome, quantos dias, como conta o ranking e quem vem
 * junto (amigos, times, grupos). O código para os outros nasce junto.
 */
export default function NewChallengeScreen() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const m = useChallengeMutations();
  const [name, setName] = useState(t('challenge.create.defaultName'));
  const [days, setDays] = useState('30');
  const [scoring, setScoring] = useState<Scoring>('days');
  const [people, setPeople] = useState<string[]>([]);

  function submit() {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      toast({ message: t('challenge.create.daysInvalid') });
      return;
    }
    if (!name.trim()) return;
    m.create
      .mutateAsync({ name: name.trim(), days: n, scoring, members: people })
      .then((id) => {
        toast({ message: t('challenge.create.created') });
        router.replace({ pathname: '/desafio/[id]', params: { id } });
      })
      .catch((e: Error) => toast({ message: t('page.error', { message: e.message }) }));
  }

  return (
    <Screen size="narrow">
      <ScreenHeader back help="repeticoes-descanso" title={t('challenge.create.title')} />
      {!online ? (
        <EmptyState title={t('challenge.offline')} />
      ) : (
        <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
          <View className={`gap-6 ${READABLE}`}>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-ink">{t('challenge.create.name')}</Text>
              <Input
                value={name}
                onChangeText={setName}
                maxLength={80}
                accessibilityLabel={t('challenge.create.name')}
              />
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-ink">{t('challenge.create.days')}</Text>
              <Input
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel={t('challenge.create.days')}
              />
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-ink">
                {t('challenge.create.scoring')}
              </Text>
              <View
                className="flex-row flex-wrap gap-2"
                accessibilityRole="radiogroup"
                accessibilityLabel={t('challenge.create.scoring')}
              >
                {SCORINGS.map((s) => (
                  <Chip
                    key={s}
                    role="radio"
                    label={t(`challenge.scoring.${s}`)}
                    selected={scoring === s}
                    onPress={() => setScoring(s)}
                  />
                ))}
              </View>
              <Text className="text-xs text-ink-muted">{t(`challenge.rule.${scoring}`)}</Text>
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-ink">{t('challenge.create.people')}</Text>
              <Text className="text-xs text-ink-muted">{t('challenge.create.peopleHint')}</Text>
              <PeoplePicker picked={people} onChange={setPeople} />
            </View>
            <Button
              className="self-start"
              label={t('challenge.create.submit')}
              loading={m.create.isPending}
              disabled={!name.trim() || m.create.isPending}
              onPress={submit}
            />
          </View>
        </ScreenScroll>
      )}
    </Screen>
  );
}
