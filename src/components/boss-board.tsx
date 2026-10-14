import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { boardHighlights } from '@/lib/board';
import { useBossBoard } from '@/lib/queries/clan';

/**
 * Quadro de contribuição: o destaque e quem também ajudou, sem ranking nem
 * "último lugar". Quem não contribuiu não aparece.
 */
export function BossBoard({
  bossId,
  unit = 'damage',
}: {
  bossId: string;
  /** Dano (boss solo e de clã) ou tarefas (boss de projeto) */
  unit?: 'damage' | 'tasks';
}) {
  const { t } = useTranslation();
  const board = useBossBoard(bossId);
  const { top, helpers } = boardHighlights(board.data ?? []);
  if (top.length === 0) {
    return board.data ? <Text className="text-xs text-ink-muted">{t('board.nobody')}</Text> : null;
  }
  const names = top
    .map(
      (p) =>
        `${p.name} (${t(unit === 'tasks' ? 'board.tasks' : 'board.damage', { count: p.damage })})`,
    )
    .join(', ');
  return (
    <View className="gap-1" accessibilityLabel={t('board.label')}>
      <Text className="text-sm text-ink">{t('board.top', { count: top.length, names })}</Text>
      {helpers.length > 0 && (
        <Text className="text-xs text-ink-muted">
          {t('board.helpers', { names: helpers.join(', ') })}
        </Text>
      )}
    </View>
  );
}
