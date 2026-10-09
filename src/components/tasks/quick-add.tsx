import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, TextInput } from 'react-native';

import { Input } from '@/components/ui/input';
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
import { useCanWrite } from '@/providers/write';

/**
 * Campo de captura rápida (ESCOPO 4.1): digita e Enter cria; o foco fica no campo.
 * Texto com várias linhas ou ";" (colado ou digitado) abre a pré-visualização do lote.
 */
export function QuickAdd({
  pageId,
  defaultDueDate,
  placeholder = 'Nova tarefa… (Enter para criar)',
  autoFocus,
  onCreated,
  parseMeta,
}: {
  pageId: string | undefined;
  defaultDueDate?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCreated?: () => void;
  /** Página de cards: "4x12" e "20kg" viram séries/repetições/carga */
  parseMeta?: boolean;
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
          id: randomUUID(),
        },
      ],
    });
    // Mais de uma pessoa com esse nome: não atribui (ESCOPO 4.5) e avisa
    const ambiguous = resolved.filter((r) => r.kind === 'ambiguous').map((r) => `@${r.name}`);
    if (ambiguous.length)
      toast({
        message: `${ambiguous.join(', ')}: mais de uma pessoa com esse nome. Escolha nos detalhes da tarefa.`,
      });
    setLastPageId(pageId);
    setText('');
    inputRef.current?.focus();
    onCreated?.();
  }

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
    <Input
      ref={inputRef}
      placeholder={
        !pageId
          ? 'Carregando…'
          : !writable
            ? 'Só leitura: você é leitor deste projeto'
            : online
              ? placeholder
              : 'Nova tarefa… (vai quando a conexão voltar)'
      }
      value={text}
      editable={writable}
      onChangeText={(value) => {
        // No celular, colar várias linhas chega aqui com as quebras
        if (/\r?\n/.test(value.trim())) openBatch(value);
        else setText(value);
      }}
      onSubmitEditing={submit}
      submitBehavior="submit"
      returnKeyType="done"
      autoFocus={autoFocus}
      accessibilityLabel="Nova tarefa"
      aria-disabled={!ready}
    />
  );
}
