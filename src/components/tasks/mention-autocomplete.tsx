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

import { Avatar } from '@/components/ui/person';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  applyMention,
  mentionQuery,
  mentionToken,
  suggestMembers,
  type MemberName,
} from '@/lib/members';

type KeyEvent = NativeSyntheticEvent<TextInputKeyPressEventData> & { preventDefault?: () => void };

/**
 * Autocomplete do @nome num campo de texto (captura e lote): ao digitar "@", sugere os membros do
 * projeto. Setas escolhem, Enter/Tab confirmam (Enter só quando `enterPicks`), Esc fecha.
 */
export function useMentionAutocomplete({
  enabled,
  members,
  text,
  setText,
  inputRef,
  enterPicks,
}: {
  enabled: boolean;
  members: MemberName[];
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
  const query = enabled ? mentionQuery(text, caret) : null;
  const suggestions =
    query && dismissed !== query.start ? suggestMembers(query.query, members) : [];
  const open = suggestions.length > 0;
  const active = Math.min(picked, suggestions.length - 1);

  function choose(member: MemberName) {
    if (!query) return;
    const next = applyMention(text, query.start, caret, mentionToken(member, members));
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
      accessibilityLabel={t('quickAdd.mentionList')}
      className="border-b border-line bg-surface py-1"
    >
      {suggestions.map((member, index) => (
        <Pressable
          key={member.userId}
          accessibilityRole="button"
          aria-selected={index === active}
          accessibilityLabel={t('quickAdd.mentionPick', { name: member.displayName })}
          onPress={() => choose(member)}
          className={cn(
            'min-h-10 flex-row items-center gap-2 px-2 md:min-h-8',
            index === active ? 'bg-accent-soft' : 'hover:bg-wash',
          )}
        >
          <Avatar name={member.displayName} />
          <Text className="flex-1 text-sm text-ink">{member.displayName}</Text>
          <Text className="font-mono text-xs text-ink-muted">@{mentionToken(member, members)}</Text>
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
