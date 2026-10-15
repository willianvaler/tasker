import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  AttributesPanel,
  ClassPicker,
  classOf,
  DamagePanel,
  EquipmentPanel,
  HeroCard,
  Panel,
  SkillsPanel,
} from '@/components/character';
import { BossLine } from '@/components/game-bar';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { bossHpForLevel } from '@/lib/character';
import { gamificationConfig as config } from '@/lib/gamification.config';
import { useGameState } from '@/lib/queries/game';
import { useProfile } from '@/lib/queries/profile';

// Ficha do personagem: classe, atributos, habilidades, conta do dano, boss e equipamento.
// Em tela larga, três colunas; no celular, uma embaixo da outra.
export default function CharacterScreen() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const profile = useProfile();
  const [choosing, setChoosing] = useState(false);

  if (!game) return <Screen size="wide">{null}</Screen>;
  const cls = classOf(game);

  if (!game.enabled) {
    return (
      <Screen>
        <ScreenHeader help="gamificacao" title={t('character.title')} back />
        <EmptyState title={t('character.off')} />
      </Screen>
    );
  }

  if (!cls || choosing) {
    return (
      <Screen size="wide">
        <ScreenHeader title={t(cls ? 'character.change' : 'character.pick')} back />
        <ScrollView contentContainerClassName="gap-4 pb-12">
          <Text className="max-w-[760px] text-sm text-ink-muted">{t('character.pickHint')}</Text>
          <ClassPicker current={cls} onDone={() => setChoosing(false)} />
          {cls && (
            <Button
              variant="ghost"
              className="self-start"
              label={t('character.keep')}
              onPress={() => setChoosing(false)}
            />
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen size="wide">
      <ScreenHeader title={t('character.title')} back />
      <ScrollView contentContainerClassName="pb-12">
        <View className="flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <View className="gap-6 lg:flex-1">
            <HeroCard game={game} name={profile.data?.display_name} />
            <SkillsPanel game={game} />
            <Button
              variant="ghost"
              className="self-start"
              label={t('character.change')}
              onPress={() => setChoosing(true)}
            />
          </View>
          <View className="gap-6 lg:flex-1">
            <AttributesPanel game={game} />
            <DamagePanel game={game} />
          </View>
          <View className="gap-6 lg:flex-1">
            {game.boss && (
              <Panel title={t('character.bossTitle', { level: game.boss.level ?? 1 })}>
                <BossLine boss={game.boss} />
                <Text className="text-xs text-ink-muted">
                  {t('character.bossHint', {
                    next: (game.boss.level ?? 1) + 1,
                    hp: bossHpForLevel((game.boss.level ?? 1) + 1),
                    xp: config.boss.rewardXp,
                  })}
                </Text>
              </Panel>
            )}
            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
              <Stat value={game.bosses_defeated} label={t('character.defeated')} />
              <Stat value={game.best_hit} label={t('character.bestHit')} />
              <Stat value={game.damage_today} label={t('character.damageToday')} />
            </View>
            <EquipmentPanel game={game} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Text className="font-mono text-xs text-ink-muted">
      <Text className="font-mono text-xs text-ink">{value}</Text> {label}
    </Text>
  );
}
