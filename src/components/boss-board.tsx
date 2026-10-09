import { Text, View } from 'react-native';

import { boardHighlights } from '@/lib/board';
import { useBossBoard } from '@/lib/queries/clan';

/**
 * Quadro de contribuição (ESCOPO 4.6): o destaque e quem também ajudou, sem ranking nem
 * "último lugar". Quem não contribuiu não aparece.
 */
export function BossBoard({
  bossId,
  unit = ['de dano', 'de dano'],
}: {
  bossId: string;
  /** Singular e plural ("tarefa", "tarefas") */
  unit?: [string, string];
}) {
  const board = useBossBoard(bossId);
  const { top, helpers } = boardHighlights(board.data ?? []);
  if (top.length === 0) {
    return board.data ? (
      <Text className="text-xs text-muted-foreground">Ninguém atacou ainda. Seja o primeiro!</Text>
    ) : null;
  }
  return (
    <View className="gap-1" accessibilityLabel="Destaques do boss">
      <Text className="text-sm text-foreground">
        🏆 {top.length > 1 ? 'Destaques' : 'Destaque'}:{' '}
        {top.map((t) => `${t.name} (${t.damage} ${unit[t.damage === 1 ? 0 : 1]})`).join(', ')}
      </Text>
      {helpers.length > 0 && (
        <Text className="text-xs text-muted-foreground">Também ajudaram: {helpers.join(', ')}</Text>
      )}
    </View>
  );
}
