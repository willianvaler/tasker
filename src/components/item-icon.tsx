import {
  Columns3,
  Folder,
  Inbox,
  LayoutGrid,
  List,
  Repeat,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { lucideOf } from '@/lib/icons';
import type { ColorToken } from '@/lib/tokens';

export type ItemKind =
  'folder' | 'project' | 'inbox' | 'list' | 'cards' | 'habits' | 'kanban' | 'expenses';

/** Ícone padrão de cada tipo. */
export const DEFAULT_ICON: Record<ItemKind, LucideIcon> = {
  folder: Folder,
  project: Users,
  inbox: Inbox,
  list: List,
  cards: LayoutGrid,
  habits: Repeat,
  kanban: Columns3,
  expenses: Wallet,
};

/**
 * Ícone de pasta, projeto ou página: o que o usuário escolheu (ícone Lucide guardado como
 * "lucide:id", ou um emoji) ou, sem escolha, o ícone do tipo. Emoji só aparece quando é escolha do usuário.
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
  const chosen = lucideOf(icon);
  if (chosen) return <Icon icon={chosen} size={size} tone={tone} />;
  if (icon && /\p{Extended_Pictographic}/u.test(icon))
    return (
      <Text aria-hidden className={size === 16 ? 'text-sm' : 'text-base'}>
        {icon}
      </Text>
    );
  return <Icon icon={DEFAULT_ICON[kind]} size={size} tone={tone} />;
}
