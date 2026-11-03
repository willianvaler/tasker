import {
  CircleAlert,
  Code,
  Search,
  FileInput,
  Heading2,
  Heading3,
  Highlighter,
  Lightbulb,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pencil,
  Superscript,
  Table,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  applySlash,
  filterSlash,
  SLASH_COMMANDS,
  slashQuery,
  type SlashCommand,
} from '@/lib/note-blocks';

type KeyEvent = NativeSyntheticEvent<TextInputKeyPressEventData> & { preventDefault?: () => void };

const ICON: Record<SlashCommand, LucideIcon> = {
  heading: Heading2,
  subheading: Heading3,
  list: List,
  numbered: ListOrdered,
  task: ListChecks,
  note: Pencil,
  tip: Lightbulb,
  warning: CircleAlert,
  table: Table,
  link: Link2,
  embed: FileInput,
  query: Search,
  highlight: Highlighter,
  footnote: Superscript,
  code: Code,
  divider: Minus,
};

/**
 * Comandos de barra (OB3): "/" no começo da linha abre a lista (título, listas, callout, tabela,
 * link, destaque, nota de rodapé, código, divisória). Digitar filtra; setas escolhem, Enter/Tab
 * confirmam, Esc fecha. Os nomes de busca valem nos três idiomas (o rótulo é o do idioma da pessoa).
 */
export function useSlashCommands({
  text,
  caret,
  setText,
  inputRef,
}: {
  text: string;
  caret: number;
  setText: (value: string, caret: number) => void;
  inputRef: RefObject<TextInput | null>;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const found = slashQuery(text, caret);
  const query = found && found.start !== dismissed ? found : null;
  const items = filterSlash(
    SLASH_COMMANDS.map((id) => ({
      id,
      label: t(`slash.${id}`),
      names: [t(`slash.${id}`), ...t(`slash.${id}Keys`).split(',')],
    })),
    query?.query ?? '',
  );
  const open = !!query && items.length > 0;
  const active = Math.min(picked, items.length - 1);

  function choose(command: SlashCommand) {
    if (!query) return;
    const next = applySlash(text, query.start, caret, command, { column: t('slash.column'), query: t('slash.queryExample') });
    setText(next.text, next.caret);
    setPicked(0);
    requestAnimationFrame(() => {
      const node = inputRef.current as unknown as HTMLTextAreaElement | null;
      node?.setSelectionRange?.(next.caret, next.caret);
      inputRef.current?.focus();
    });
  }

  /** Devolve true se a tecla foi usada pela lista */
  function onKeyPress(e: KeyEvent) {
    if (!open) return false;
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault?.();
      const step = key === 'ArrowDown' ? 1 : -1;
      setPicked((active + step + items.length) % items.length);
      return true;
    }
    if (key === 'Tab' || key === 'Enter') {
      e.preventDefault?.();
      choose(items[active].id);
      return true;
    }
    if (key === 'Escape') {
      setDismissed(query?.start ?? null);
      return true;
    }
    return false;
  }

  const list = open ? (
    <ScrollView
      accessibilityRole="list"
      accessibilityLabel={t('slash.title')}
      keyboardShouldPersistTaps="always"
      className="max-h-72 border-b border-line bg-surface py-1"
    >
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          aria-selected={index === active}
          accessibilityLabel={item.label}
          onPress={() => choose(item.id)}
          className={cn(
            'min-h-10 flex-row items-center gap-2 px-2 md:min-h-8',
            index === active ? 'bg-accent-soft' : 'hover:bg-wash',
          )}
        >
          <Icon icon={ICON[item.id]} size={16} tone="ink-muted" />
          <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  ) : null;

  return { open, onKeyPress, list, onChangeText: () => setPicked(0) };
}
