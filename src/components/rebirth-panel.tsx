import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Panel } from '@/components/character';
import { Button } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { achievementText } from '@/lib/achievements';
import { rebirthBonus } from '@/lib/gamification';
import { gamificationConfig } from '@/lib/gamification.config';
import type { GameState } from '@/lib/queries/game';
import { useRebirth } from '@/lib/queries/game-mode';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const { minLevel, maxBonus } = gamificationConfig.rebirth;
const pct = (value: number) => Math.round(value * 100);

/**
 * Renascer (V4 §1.4, R1; D210): do nível 20 em diante, volta ao nível 1 com um bônus de XP
 * permanente. Confirmação forte: digitar a palavra "renascer".
 */
export function RebirthPanel({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const rebirth = useRebirth();
  const online = useIsOnline();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const bonus = rebirthBonus(game.rebirths);
  const nextBonus = rebirthBonus(game.rebirths + 1);
  const ready = game.level >= minLevel;
  const word = t('rebirth.word');

  return (
    <Panel title={t('rebirth.title')}>
      {game.rebirths > 0 && (
        <Text className="font-mono text-xs text-ink">
          🔥 {t('rebirth.count', { count: game.rebirths, bonus: pct(bonus) })}
        </Text>
      )}
      <Text className="text-xs text-ink-muted">
        {t('rebirth.hint', { level: minLevel, bonus: pct(nextBonus), max: pct(maxBonus) })}
      </Text>
      <Button
        variant={ready ? 'primary' : 'ghost'}
        className="self-start"
        label={ready ? t('rebirth.action') : t('rebirth.locked', { level: minLevel })}
        disabled={!ready || !online || game.dead}
        loading={rebirth.isPending}
        onPress={() => setConfirming(true)}
      />
      {confirming && (
        <PromptDialog
          title={t('rebirth.confirmTitle')}
          message={t('rebirth.confirmMessage', { level: game.level, bonus: pct(nextBonus), word })}
          fields={[{ key: 'word', placeholder: word, maxLength: 20 }]}
          confirmLabel={t('rebirth.action')}
          validate={(v) => v.word?.trim().toLowerCase() === word.toLowerCase()}
          onConfirm={() => {
            setConfirming(false);
            rebirth.mutate(undefined, {
              onSuccess: (r) =>
                toast({
                  message: [
                    t('rebirth.done', { count: r.rebirths, bonus: pct(r.bonus) }),
                    ...r.achievements.map((a) => `${a.icon} ${achievementText(a).name}`),
                  ].join(' · '),
                }),
              onError: (e) => toast({ message: e.message }),
            });
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </Panel>
  );
}
