import { Link2 } from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  View,
  type NativeSyntheticEvent,
  type TextInput,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/person';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  applyMention,
  mentionQuery,
  mentionToken,
  nameKey,
  suggestMembers,
  type MemberName,
} from '@/lib/members';
import { prereqToken, type PrereqCandidate } from '@/lib/prereqs';

type KeyEvent = NativeSyntheticEvent<TextInputKeyPressEventData> & { preventDefault?: () => void };

type Suggestion = { key: string; label: string; token: string; kind: 'member' | 'task' };

/**
 * Autocomplete na captura e no lote: "@" sugere as pessoas do projeto; "^" sugere as tarefas do
 * projeto (pré-requisito). Setas escolhem, Enter/Tab confirmam (Enter só quando `enterPicks`), Esc
 * fecha.
 */
export function useMentionAutocomplete({
  enabled,
  members,
  tasks = [],
  text,
  setText,
  inputRef,
  enterPicks,
}: {
  enabled: boolean;
  members: MemberName[];
  /** Tarefas para o "^" (vazio: o "^" não sugere nada) */
  tasks?: readonly PrereqCandidate[];
  text: string;
  setText: (value: string) => void;
  inputRef: RefObject<TextInput | null>;
  /** Campo de várias linhas: o Enter com a lista aberta escolhe em vez de quebrar a linha */
  enterPicks?: boolean;
}) {
  const { t } = useTranslation();
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);

  const atQuery = enabled ? mentionQuery(text, caret, '@') : null;
  const caretQuery = enabled && tasks.length ? mentionQuery(text, caret, '^') : null;
  const query = atQuery ?? caretQuery;
  const trigger: '@' | '^' = atQuery ? '@' : '^';
  let suggestions: Suggestion[] = [];
  if (query && dismissed !== query.start) {
    if (atQuery)
      suggestions = suggestMembers(query.query, members).map((m) => ({
        key: m.userId,
        label: m.displayName,
        token: mentionToken(m, members),
        kind: 'member',
      }));
    else {
      const key = nameKey(query.query);
      suggestions = tasks
        .filter((task) => !key || nameKey(task.title).includes(key))
        .slice(0, 6)
        .map((task) => ({
          key: task.id,
          label: task.title,
          token: prereqToken(task.title),
          kind: 'task',
        }));
    }
  }
  const open = suggestions.length > 0;
  const active = Math.min(picked, suggestions.length - 1);

  function choose(suggestion: Suggestion) {
    if (!query) return;
    const next = applyMention(text, query.start, caret, suggestion.token, trigger);
    setText(next.text);
    setCaret(next.caret);
    setPicked(0);
    // Na web, o cursor vai para depois do nome escolhido
    requestAnimationFrame(() => {
      const node = inputRef.current as unknown as HTMLInputElement | null;
      node?.setSelectionRange?.(next.caret, next.caret);
      inputRef.current?.focus();
    });
  }

  /** Devolve true se a tecla foi usada pela lista. */
  function onKeyPress(e: KeyEvent) {
    if (!open) return false;
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault?.();
      const step = key === 'ArrowDown' ? 1 : -1;
      setPicked((active + step + suggestions.length) % suggestions.length);
      return true;
    }
    if (key === 'Tab' || (enterPicks && key === 'Enter')) {
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
      accessibilityLabel={t(trigger === '@' ? 'quickAdd.mentionList' : 'quickAdd.prereqList')}
      className="border-b border-line bg-surface py-1"
    >
      {suggestions.map((s, index) => (
        <Pressable
          key={s.key}
          accessibilityRole="button"
          aria-selected={index === active}
          accessibilityLabel={t(
            s.kind === 'member' ? 'quickAdd.mentionPick' : 'quickAdd.prereqPick',
            {
              name: s.label,
            },
          )}
          onPress={() => choose(s)}
          className={cn(
            'min-h-10 flex-row items-center gap-2 px-2 md:min-h-8',
            index === active ? 'bg-accent-soft' : 'hover:bg-wash',
          )}
        >
          {s.kind === 'member' ? (
            <Avatar name={s.label} />
          ) : (
            <Icon icon={Link2} size={16} tone="ink-muted" />
          )}
          <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
            {s.label}
          </Text>
          <Text className="font-mono text-xs text-ink-muted" numberOfLines={1}>
            {trigger}
            {s.token}
          </Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  return {
    open,
    /** Escolhe a sugestão marcada (o Enter do campo de uma linha chama isto) */
    pickActive: () => choose(suggestions[active]),
    onKeyPress,
    onSelectionChange: (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) =>
      setCaret(e.nativeEvent.selection.end),
    /** Texto mudou pelo teclado: volta para a primeira sugestão */
    onChangeText: () => setPicked(0),
    list,
  };
}
