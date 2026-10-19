import { useEffect } from 'react';

import { setGameVocab } from '@/i18n';
import { useGameLevel, useGameState } from '@/lib/queries/game';

/** Liga o vocabulário de jogo (HB11) no modo Completo, se a pessoa não o desligou. */
export function GameVocab() {
  const full = useGameLevel() === 'full';
  const vocab = useGameState().data?.vocab !== false;
  useEffect(() => setGameVocab(full && vocab), [full, vocab]);
  return null;
}
