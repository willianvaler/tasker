import {
  Columns3,
  Folder,
  Inbox,
  LayoutGrid,
  List,
  Repeat,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ColorToken } from '@/lib/tokens';

export type ItemKind = 'folder' | 'project' | 'inbox' | 'list' | 'cards' | 'habits' | 'kanban';

/** Ícone padrão de cada tipo (V2 §8.1: nada fica "sem cara"). */
export const DEFAULT_ICON: Record<ItemKind, LucideIcon> = {
  folder: Folder,
  project: Users,
  inbox: Inbox,
  list: List,
  cards: LayoutGrid,
  habits: Repeat,
  kanban: Columns3,
};

/**
 * Ícone de pasta, projeto ou página: o emoji que o usuário escolheu ou, sem escolha, o ícone do
 * tipo (Lucide). Emoji só aparece quando é escolha do usuário (docs/DESIGN.md).
 */
export function ItemIcon({
  icon,
  kind,
  size = 16,
  tone = 'ink-muted',
}: {
  icon?: string | null;
  kind: ItemKind;
  size?: 16 | 20;
  tone?: ColorToken;
}) {
  if (icon && /\p{Extended_Pictographic}/u.test(icon))
    return (
      <Text aria-hidden className={size === 16 ? 'text-sm' : 'text-base'}>
        {icon}
      </Text>
    );
  return <Icon icon={DEFAULT_ICON[kind]} size={size} tone={tone} />;
}
