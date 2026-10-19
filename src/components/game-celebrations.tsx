import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeOut, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { getGameSounds } from '@/lib/prefs';
import { useGameLevel, useGameState } from '@/lib/queries/game';

type Celebration = { kind: 'level' | 'boss'; text: string };

/**
 * Celebrações do modo Completo (HB11): subir de nível e derrubar boss mostram um aviso animado
 * com som curto. Com "reduzir movimento", aparece sem animação; o som se desliga no Perfil.
 * Olha só o estado do jogo (vale para qualquer tela que conclua algo).
 */
export function GameCelebrations() {
  const { t } = useTranslation();
  const full = useGameLevel() === 'full';
  const { data: game } = useGameState();
  const reduced = useReducedMotion();
  const level = useAudioPlayer(require('../../assets/sounds/nivel.wav'));
  const boss = useAudioPlayer(require('../../assets/sounds/boss.wav'));
  const item = useAudioPlayer(require('../../assets/sounds/item.wav'));
  const [shown, setShown] = useState<Celebration | null>(null);
  const prev = useRef<{ level: number; bosses: number; items: number } | null>(null);

  useEffect(() => {
    if (!game || !full) {
      prev.current = null;
      return;
    }
    const now = {
      level: game.level,
      bosses: game.bosses_defeated + game.daily_defeated,
      items: game.inventory.length,
    };
    const before = prev.current;
    prev.current = now;
    // A primeira leitura só guarda o ponto de partida
    if (!before) return;
    const play = (p: typeof level) => {
      if (!getGameSounds()) return;
      p.seekTo(0);
      p.play();
    };
    if (now.level > before.level) {
      setShown({ kind: 'level', text: t('reward.levelUp', { level: now.level }) });
      play(level);
    } else if (now.bosses > before.bosses) {
      setShown({ kind: 'boss', text: t('reward.bossDefeated') });
      play(boss);
    } else if (now.items > before.items) {
      play(item);
    }
  }, [game, full, t, level, boss, item]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-24 items-center px-4">
      <Animated.View
        entering={reduced ? undefined : ZoomIn.springify()}
        exiting={reduced ? undefined : FadeOut}
      >
        <View
          accessibilityLiveRegion="polite"
          aria-live="polite"
          className="items-center gap-1 rounded-lg border border-accent bg-surface px-6 py-4"
        >
          <Text style={{ fontSize: 32, lineHeight: 40 }}>{shown.kind === 'level' ? '⭐' : '🏆'}</Text>
          <Text className="font-serif text-xl text-ink">{shown.text}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
