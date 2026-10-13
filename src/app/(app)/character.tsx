import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

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
import { bossHpForLevel } from '@/lib/character';
import { gamificationConfig as config } from '@/lib/gamification.config';
import { useGameState } from '@/lib/queries/game';
import { useProfile } from '@/lib/queries/profile';

// Ficha do personagem (D60 a D64): classe, atributos, habilidades, conta do dano, boss e equipamento.
// Em tela larga, três colunas; no celular, uma embaixo da outra.
export default function CharacterScreen() {
  const { data: game } = useGameState();
  const profile = useProfile();
  const [choosing, setChoosing] = useState(false);

  if (!game) return <Screen size="wide">{null}</Screen>;
  const cls = classOf(game);

  if (!game.enabled) {
    return (
      <Screen>
        <ScreenHeader title="Personagem" back />
        <Text className="text-muted-foreground">
          A gamificação está desligada. Ligue no Perfil para ter personagem, boss e loja.
        </Text>
      </Screen>
    );
  }

  if (!cls || choosing) {
    return (
      <Screen size="wide">
        <ScreenHeader title={cls ? 'Trocar de classe' : 'Escolha sua classe'} back />
        <ScrollView contentContainerClassName="gap-4 pb-16">
          <Text className="text-muted-foreground">
            A classe é o seu estilo: muda os atributos iniciais e dá uma passiva e uma habilidade
            por dia. Dá para trocar depois, sem custo.
          </Text>
          <ClassPicker current={cls} onDone={() => setChoosing(false)} />
          {cls && (
            <Button
              variant="ghost"
              className="self-start"
              label="Manter a classe atual"
              onPress={() => setChoosing(false)}
            />
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen size="wide">
      <ScreenHeader title="Personagem" back />
      <ScrollView contentContainerClassName="pb-16">
        <View className="flex-col gap-4 lg:flex-row lg:items-start">
          <View className="gap-4 lg:flex-1">
            <HeroCard game={game} name={profile.data?.display_name} />
            <SkillsPanel game={game} />
            <Button
              variant="outline"
              className="self-start"
              label="Trocar de classe"
              onPress={() => setChoosing(true)}
            />
          </View>
          <View className="gap-4 lg:flex-1">
            <AttributesPanel game={game} />
            <DamagePanel game={game} />
          </View>
          <View className="gap-4 lg:flex-1">
            {game.boss && (
              <Panel title={`Boss da semana · nível ${game.boss.level ?? 1}`}>
                <BossLine boss={game.boss} />
                <Text className="text-xs text-muted-foreground">
                  Cada vitória sobe o nível do próximo boss (nível {(game.boss.level ?? 1) + 1}:{' '}
                  {bossHpForLevel((game.boss.level ?? 1) + 1)} HP) e dá {config.boss.rewardXp} XP,
                  ouro e um item sorteado. Se ele fugir, o próximo vem sem punição. Hábitos ruins
                  curam o boss.
                </Text>
              </Panel>
            )}
            <View className="flex-row gap-2">
              <Stat label="Bosses vencidos" value={`🏆 ${game.bosses_defeated}`} />
              <Stat label="Maior golpe" value={`💥 ${game.best_hit}`} />
              <Stat label="Dano hoje" value={`⚔️ ${game.damage_today}`} />
            </View>
            <EquipmentPanel game={game} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-xl border border-border bg-card py-2">
      <Text className="text-lg font-bold text-foreground">{value}</Text>
      <Text className="text-center text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
