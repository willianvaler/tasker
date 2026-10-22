import { router } from 'expo-router';
import { Backpack, Gift, PawPrint, Shield, ShoppingBag, Swords, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CampView } from '@/components/camp';
import { GameProfile } from '@/components/game-profile';
import { HeroPanel } from '@/components/hero-panel';
import { HubRow, HubSection } from '@/components/hub';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useGameLevel, useGameState } from '@/lib/queries/game';
import { useProfile, useToday } from '@/lib/queries/profile';
import { useHabits, useTodayTasks } from '@/lib/queries/tasks';
import { asRecurrence, isHabitDueOn } from '@/lib/recurrence';

// Jogo (D257): personagem, bosses, lugares do jogo e os números, numa tela. Antes eram nove telas
// com quatro entradas diferentes (rodapé da barra lateral, Perfil, Personagem, acampamento). No
// RPG a capa é o acampamento (que antes era o topo do Início); no Discreto, o cartão do herói.
export default function GameScreen() {
  const { t } = useTranslation();
  const { data: game } = useGameState();
  const level = useGameLevel();
  const today = useToday();
  const tasks = useTodayTasks(today);
  const habits = useHabits(today);
  const firstName = useProfile().data?.display_name.split(' ')[0];

  const open = (tasks.data ?? []).length;
  const habitsLeft = (habits.data ?? []).filter(
    (h) =>
      h.habit_kind !== 'plusminus' &&
      h.status !== 'done' &&
      isHabitDueOn(asRecurrence(h.recurrence), today),
  ).length;

  return (
    <Screen size="wide">
      <ScreenScroll contentContainerClassName="gap-8 pb-clear">
        <ScreenHeader search help="gamificacao" title={t('nav.game')} />
        {!game?.enabled ? (
          <View className="items-center">
            <EmptyState title={t('hub.game.off')} hint={t('hub.game.offHint')} />
            <Button
              variant="ghost"
              label={t('nav.settings')}
              onPress={() => router.push('/configuracoes')}
            />
          </View>
        ) : (
          <View className="gap-8 lg:flex-row lg:items-start lg:gap-12">
            <View className="gap-8 lg:flex-1">
              {level === 'full' ? (
                <CampView name={firstName} missions={open + habitsLeft} />
              ) : (
                <HeroPanel />
              )}
              <HubSection title={t('hub.game.places')}>
                <HubRow
                  icon={Swords}
                  label={t('nav.character')}
                  hint={t('hub.game.characterHint')}
                  href="/character"
                />
                <HubRow
                  icon={ShoppingBag}
                  label={t('nav.shop')}
                  hint={t('hub.game.shopHint')}
                  href="/shop"
                />
                <HubRow
                  icon={Backpack}
                  label={t('inventory.title')}
                  hint={t('hub.game.inventoryHint')}
                  href="/inventario"
                />
                <HubRow
                  icon={Trophy}
                  label={t('achievements.title')}
                  hint={t('hub.game.achievementsHint')}
                  href="/conquistas"
                />
                <HubRow
                  icon={Gift}
                  label={t('game.rewardsLink')}
                  hint={t('hub.game.rewardsHint')}
                  href="/recompensas"
                />
                {level === 'full' && (
                  <HubRow
                    icon={PawPrint}
                    label={t('game.stableLink')}
                    hint={t('hub.game.stableHint')}
                    href="/estabulo"
                  />
                )}
                <HubRow
                  icon={Shield}
                  label={t('nav.clan')}
                  hint={t('hub.people.clanHint')}
                  href="/clan"
                />
              </HubSection>
            </View>
            <View className="lg:flex-1">
              <GameProfile />
            </View>
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}
