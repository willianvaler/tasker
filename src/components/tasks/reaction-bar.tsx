import { SmilePlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { actorCan } from '@/lib/permissions';
import { useFolderActor } from '@/lib/queries/projects';
import { useToggleReaction } from '@/lib/queries/reactions';
import { REACTIONS, summarize, type Reaction, type ReactionTarget } from '@/lib/reactions';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';

/**
 * Reações de uma tarefa concluída ou de um comentário (PB2, D222): os emojis já usados, com a
 * contagem, e o botão que abre os outros. Reagir pede conexão e a permissão de comentar.
 */
export function ReactionBar({
  target,
  folderId,
  reactions,
}: {
  target: ReactionTarget;
  folderId: string;
  reactions: Reaction[];
}) {
  const { t } = useTranslation();
  const me = useSession().session?.user.id;
  const online = useIsOnline();
  const actor = useFolderActor(folderId);
  const toggle = useToggleReaction();
  const [picking, setPicking] = useState(false);
  const can = online && actorCan(actor, 'comment.create');
  const used = summarize(reactions, target, me);
  if (!can && used.length === 0) return null;

  const chip = (emoji: string, count: number, mine: boolean) => (
    <Pressable
      key={emoji}
      accessibilityRole="button"
      aria-pressed={mine}
      aria-disabled={!can}
      disabled={!can}
      accessibilityLabel={t('reactions.react', { emoji, count })}
      onPress={() => {
        setPicking(false);
        toggle.mutate({ target, emoji, mine });
      }}
      className={cn(
        'min-h-8 flex-row items-center gap-1 rounded border border-line px-2',
        mine && 'border-accent bg-wash',
      )}
    >
      <Text className="text-sm">{emoji}</Text>
      {count > 0 && <Text className="font-mono text-xs text-ink">{count}</Text>}
    </Pressable>
  );

  return (
    <View className="flex-row flex-wrap items-center gap-1">
      {used.map((s) => chip(s.emoji, s.count, s.mine))}
      {picking &&
        REACTIONS.filter((e) => !used.some((s) => s.emoji === e)).map((e) => chip(e, 0, false))}
      {can && !picking && (
        <Pressable
          accessibilityRole="button"
          aria-expanded={picking}
          accessibilityLabel={t('reactions.add')}
          onPress={() => setPicking(true)}
          className="min-h-8 items-center justify-center rounded px-1 hover:bg-wash"
        >
          <Icon icon={SmilePlus} size={16} tone="ink-muted" />
        </Pressable>
      )}
    </View>
  );
}
