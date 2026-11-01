import { CheckSquare, FileText, Folder, List, Plus, type LucideIcon } from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  View,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useLinkCandidates } from '@/lib/queries/links';
import { applyLink, cleanLinkTitle, linkMarkup, linkQuery, type LinkKind } from '@/lib/wikilinks';

type KeyEvent = NativeSyntheticEvent<TextInputKeyPressEventData> & { preventDefault?: () => void };

export const LINK_ICON: Record<LinkKind, LucideIcon> = {
  note: FileText,
  task: CheckSquare,
  page: List,
  folder: Folder,
};

type Suggestion = {
  key: string;
  label: string;
  context: string | null;
  markup: string;
  icon: LucideIcon;
};

/**
 * Autocomplete do "[[" (OB1, D286): anotações (as recentes primeiro), tarefas, listas e projetos;
 * a última opção é o link para o que ainda não existe ([[Título]], cria ao tocar). Setas escolhem,
 * Enter/Tab confirmam, Esc fecha. `caret` é a posição do cursor no texto.
 */
export function useWikilinkAutocomplete({
  text,
  caret,
  setText,
  inputRef,
  exclude,
}: {
  text: string;
  caret: number;
  /** Texto novo e onde o cursor fica */
  setText: (value: string, caret: number) => void;
  inputRef: RefObject<TextInput | null>;
  /** A própria anotação não aparece */
  exclude?: string;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const found = linkQuery(text, caret);
  const query = found && found.start !== dismissed ? found : null;
  const candidates = useLinkCandidates(query ? query.query : null, exclude);

  const suggestions: Suggestion[] = candidates.map((c) => ({
    key: `${c.kind}:${c.id}`,
    label: c.title,
    context: c.context,
    markup: linkMarkup(c.title, c.kind, c.id),
    icon: LINK_ICON[c.kind],
  }));
  const typed = query?.query.trim() ?? '';
  if (
    typed &&
    !candidates.some((c) => c.kind === 'note' && c.title.toLowerCase() === typed.toLowerCase())
  )
    suggestions.push({
      key: 'new',
      label: t('wikilinks.newLink', { title: cleanLinkTitle(typed) }),
      context: null,
      markup: `[[${cleanLinkTitle(typed)}]]`,
      icon: Plus,
    });
  const open = !!query && suggestions.length > 0;
  const active = Math.min(picked, suggestions.length - 1);

  function choose(suggestion: Suggestion) {
    if (!query) return;
    const next = applyLink(text, query.start, caret, suggestion.markup);
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
      setPicked((active + step + suggestions.length) % suggestions.length);
      return true;
    }
    if (key === 'Tab' || key === 'Enter') {
      e.preventDefault?.();
      choose(suggestions[active]);
      return true;
    }
    if (key === 'Escape') {
      setDismissed(query?.start ?? null);
      return true;
    }
    return false;
  }

  const list = open ? (
    <View
      accessibilityRole="list"
      accessibilityLabel={t('wikilinks.suggestions')}
      className="max-h-64 overflow-hidden border-b border-line bg-surface py-1"
    >
      {suggestions.map((s, index) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          aria-selected={index === active}
          accessibilityLabel={s.key === 'new' ? s.label : t('wikilinks.pick', { title: s.label })}
          onPress={() => choose(s)}
          className={cn(
            'min-h-10 flex-row items-center gap-2 px-2 md:min-h-8',
            index === active ? 'bg-accent-soft' : 'hover:bg-wash',
          )}
        >
          <Icon icon={s.icon} size={16} tone="ink-muted" />
          <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
            {s.label}
          </Text>
          {s.context && (
            <Text className="max-w-[40%] text-xs text-ink-muted" numberOfLines={1}>
              {s.context}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  ) : null;

  return { open, onKeyPress, list, onChangeText: () => setPicked(0) };
}
