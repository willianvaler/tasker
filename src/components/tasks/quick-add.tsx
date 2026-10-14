import { uuidv7 } from '@/lib/uuid';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, TextInput, useWindowDimensions, View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text, textClass } from '@/components/ui/text';
import { setBatchDraft } from '@/lib/batch-draft';
import { looksLikeBatch } from '@/lib/parser/batch';
import { parseQuickInput } from '@/lib/parser/quick';
import { setLastPageId } from '@/lib/prefs';
import { useMentions } from '@/lib/queries/mentions';
import { useToday } from '@/lib/queries/profile';
import { useCreateTasks } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';
import { setCaptureFocus } from '@/lib/ui-state';
import { useCanWrite } from '@/providers/write';
import { useColors } from '@/lib/tokens';

/**
 * Campo de captura rápida: digita e Enter cria; o foco fica no campo.
 * Texto com várias linhas ou ";" (colado ou digitado) abre a pré-visualização do lote.
 */
export function QuickAdd({
  pageId,
  defaultDueDate,
  placeholder,
  autoFocus,
  onCreated,
  parseMeta,
  habit,
}: {
  pageId: string | undefined;
  defaultDueDate?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCreated?: () => void;
  /** Página de cards: "4x12" e "20kg" viram séries/repetições/carga */
  parseMeta?: boolean;
  /** Hábito: tipo e meta escolhidos ao lado do campo */
  habit?: { kind: 'check' | 'counter' | 'plusminus'; target?: number };
}) {
  const online = useIsOnline();
  const tree = useTree();
  // Leitor do projeto não cria tarefas
  const writable = useCanWrite(tree.data?.pages.find((p) => p.id === pageId)?.folder_id, {
    offline: true,
  });
  const today = useToday();
  const create = useCreateTasks();
  const mentions = useMentions(pageId);
  const toast = useToast();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { t } = useTranslation();
  const colors = useColors();
  const wide = useWindowDimensions().width >= 768;
  // O react-native-web ainda só entende o antigo blurOnSubmit (o Input faz o mesmo)
  const webSubmit = Platform.OS === 'web' ? ({ blurOnSubmit: false } as object) : {};
  const ready = !!pageId && writable;

  function openBatch(batchText: string) {
    if (!pageId) return;
    setBatchDraft(pageId, batchText);
    setText('');
    router.push('/batch');
  }

  function submit() {
    const trimmed = text.trim();
    // Ainda carregando ou offline: o texto fica no campo (nada se perde)
    if (!trimmed || !pageId || !writable) return;
    if (looksLikeBatch(trimmed)) return openBatch(trimmed);

    const parsed = parseQuickInput(trimmed, {
      today,
      meta: parseMeta,
      mentions: mentions.enabled,
    });
    const resolved = mentions.resolve(parsed.mentions);
    create.mutate({
      pageId,
      items: [
        {
          ...parsed,
          dueDate: parsed.dueDate ?? defaultDueDate ?? null,
          assignees: mentions.toAssignees(resolved),
          id: uuidv7(),
          ...(habit ? { habitKind: habit.kind, habitTarget: habit.target ?? null } : {}),
        },
      ],
    });
    // Mais de uma pessoa com esse nome: não atribui e avisa
    const ambiguous = resolved.filter((r) => r.kind === 'ambiguous').map((r) => `@${r.name}`);
    if (ambiguous.length)
      toast({
        message: t('quickAdd.ambiguous', { names: ambiguous.join(', ') }),
      });
    setLastPageId(pageId);
    setText('');
    inputRef.current?.focus();
    onCreated?.();
  }

  // Q/N põem o foco aqui quando esta é a tela em foco
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    setCaptureFocus(() => inputRef.current?.focus());
    return () => setCaptureFocus(null);
  }, [focused]);

  // Na web, o <input> de uma linha troca as quebras de linha por espaço ao colar; intercepta antes
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = inputRef.current as unknown as HTMLInputElement | null;
    if (!node?.addEventListener) return;
    const onPaste = (event: ClipboardEvent) => {
      const pasted = event.clipboardData?.getData('text') ?? '';
      if (!/\r?\n/.test(pasted.trim())) return;
      event.preventDefault();
      openBatch(`${text}${pasted}`);
    };
    node.addEventListener('paste', onPaste);
    return () => node.removeEventListener('paste', onPaste);
  });

  return (
    // Linha de captura: "+" no acento, campo sem caixa, divisória fina
    <View className="min-h-11 flex-row items-center gap-3 border-b border-line md:min-h-10">
      <Icon icon={Plus} tone={ready ? 'accent' : 'ink-muted'} />
      <TextInput
        ref={inputRef}
        placeholder={
          !pageId
            ? t('quickAdd.loading')
            : !writable
              ? t('quickAdd.readOnly')
              : online
                ? (placeholder ?? t('quickAdd.placeholder'))
                : t('quickAdd.offline')
        }
        placeholderTextColor={colors['ink-muted']}
        value={text}
        editable={writable}
        onChangeText={(value) => {
          // No celular, colar várias linhas chega aqui com as quebras
          if (/\r?\n/.test(value.trim())) openBatch(value);
          else setText(value);
        }}
        onSubmitEditing={submit}
        // Esc sai do campo: as teclas voltam a ser atalhos (N, J, F2…)
        onKeyPress={(e) => e.nativeEvent.key === 'Escape' && inputRef.current?.blur()}
        submitBehavior="submit"
        {...webSubmit}
        returnKeyType="done"
        autoFocus={autoFocus}
        accessibilityLabel={t('quickAdd.label')}
        aria-disabled={!ready}
        className={textClass('min-h-10 flex-1 text-base text-ink md:text-sm')}
      />
      {wide && ready && !text && (
        <Text className="font-mono text-xs text-ink-muted">{t('quickAdd.hint')}</Text>
      )}
      {ready && !habit && (
        <IconButton
          icon={SlidersHorizontal}
          label={t('newMenu.advanced')}
          onPress={() =>
            router.push({ pathname: '/task/new', params: pageId ? { page: pageId } : {} })
          }
        />
      )}
    </View>
  );
}
