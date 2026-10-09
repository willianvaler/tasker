import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { MentionChips } from '@/components/tasks/assignee-chips';
import { TaskMeta } from '@/components/tasks/task-meta';
import { Button } from '@/components/ui/button';
import { takeBatchDraft } from '@/lib/batch-draft';
import { cn } from '@/lib/cn';
import { countBatch, parseBatchInput, type BatchChild } from '@/lib/parser/batch';
import { parseQuickInput } from '@/lib/parser/quick';
import { setLastPageId } from '@/lib/prefs';
import type { MentionResolution } from '@/lib/members';
import { useMentions } from '@/lib/queries/mentions';
import { useToday } from '@/lib/queries/profile';
import { useCreateTasks, type Task } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

// Criação em lote (ESCOPO 4.1): cola o texto, confere a pré-visualização, edita ou tira itens e confirma.
// O texto é a fonte; editar um item na prévia guarda só aquela linha (some se o texto mudar).
export default function BatchScreen() {
  const [draft] = useState(() => takeBatchDraft());
  const tree = useTree();
  const today = useToday();
  const create = useCreateTasks();
  const toast = useToast();

  const [text, setText] = useState(draft?.text ?? '');
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  // @nome ambíguo resolvido na prévia: "chave do item|nome" → user_id
  const [choices, setChoices] = useState<Record<string, string>>({});

  const page = tree.data?.pages.find((p) => p.id === draft?.pageId);
  // Em cards, "4x12" e "20kg" viram séries/repetições/carga
  const isCards = page?.view_type === 'cards';
  const mentions = useMentions(page?.id);
  // Criar vai para a fila offline (D52)
  const writable = useCanWrite(page?.folder_id, { offline: true });

  // Cada item tem uma chave "posição do item.posição da subtarefa" ("3" ou "3.1")
  const items = useMemo(() => {
    const parseOptions = { today, meta: isCards, mentions: mentions.enabled };
    const reparse = (key: string, item: BatchChild): BatchChild =>
      key in edits
        ? {
            ...parseQuickInput(edits[key], parseOptions),
            raw: edits[key],
            done: item.done,
          }
        : item;
    return parseBatchInput(text, parseOptions)
      .map((item, i) => ({
        ...reparse(`${i}`, item),
        key: `${i}`,
        children: item.children
          .map((c, j) => ({ ...reparse(`${i}.${j}`, c), key: `${i}.${j}` }))
          .filter((c) => !removed.has(c.key)),
      }))
      .filter((item) => !removed.has(item.key));
  }, [text, edits, removed, today, isCards, mentions.enabled]);

  /** Resolução dos @nomes do item, com as escolhas feitas na prévia. */
  function resolutionsOf(key: string, names: string[]): MentionResolution[] {
    return mentions.resolve(names).map((r) => {
      const chosen = choices[`${key}|${r.name}`];
      return r.kind === 'ambiguous' && chosen
        ? { kind: 'member', name: r.name, userId: chosen }
        : r;
    });
  }
  const assigneesOf = (key: string, names: string[]) =>
    mentions.toAssignees(resolutionsOf(key, names));
  const choose = (key: string) => (name: string, userId: string) =>
    setChoices((c) => ({ ...c, [`${key}|${name}`]: userId }));

  const total = countBatch(items);

  function changeText(value: string) {
    setText(value);
    // As chaves dependem da posição; com o texto mudando, edições e remoções antigas não valem mais
    setRemoved(new Set());
    setEdits({});
    setChoices({});
  }

  function confirm() {
    if (!page || total === 0) return;
    create.mutate(
      {
        pageId: page.id,
        items: items.map((item) => ({
          ...item,
          assignees: assigneesOf(item.key, item.mentions),
          children: item.children.map((c) => ({ ...c, assignees: assigneesOf(c.key, c.mentions) })),
          id: randomUUID(),
        })),
      },
      { onError: (err) => toast({ message: `Não deu para criar: ${err.message}` }) },
    );
    setLastPageId(page.id);
    toast({
      message: `${total} ${total === 1 ? 'tarefa criada' : 'tarefas criadas'} em ${pageLabel(page)}`,
    });
    router.back();
  }

  if (!draft) {
    return (
      <Screen>
        <ScreenHeader title="Adicionar várias" back />
        <Text className="mt-6 text-muted-foreground">
          Abra pela página onde quer criar as tarefas.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Adicionar várias" back />
      <Text className="mb-2 text-sm text-muted-foreground">
        Em {page ? pageLabel(page) : '…'} · uma por linha ou separadas por &quot;;&quot; · recuo =
        subtarefa · [x] = já feita
      </Text>
      <TextInput
        multiline
        autoFocus={!draft.text}
        value={text}
        onChangeText={changeText}
        placeholder={
          'Cole ou digite a lista, por exemplo:\ncarne; cerveja; carvão\ngelo !!\n- [x] convidar a galera'
        }
        placeholderTextColor="#94a3b8"
        accessibilityLabel="Lista de tarefas"
        textAlignVertical="top"
        className="max-h-48 min-h-28 rounded-lg border border-border bg-background p-3 text-base text-foreground"
      />

      <Text className="mt-4 font-semibold text-foreground" accessibilityLiveRegion="polite">
        {total === 0
          ? 'Nenhuma tarefa ainda'
          : `${total} ${total === 1 ? 'tarefa será criada' : 'tarefas serão criadas'}`}
      </Text>
      <ScrollView className="mt-1 flex-1" keyboardShouldPersistTaps="handled">
        {items.map((item) => (
          <View key={item.key}>
            <PreviewRow
              item={item}
              today={today}
              mentions={resolutionsOf(item.key, item.mentions)}
              onChoose={choose(item.key)}
              onEdit={(raw) => setEdits((e) => ({ ...e, [item.key]: raw }))}
              onRemove={() => setRemoved((r) => new Set(r).add(item.key))}
            />
            {item.children.map((child) => (
              <PreviewRow
                key={child.key}
                child
                item={child}
                today={today}
                mentions={resolutionsOf(child.key, child.mentions)}
                onChoose={choose(child.key)}
                onEdit={(raw) => setEdits((e) => ({ ...e, [child.key]: raw }))}
                onRemove={() => setRemoved((r) => new Set(r).add(child.key))}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-end gap-2 py-3">
        <Button variant="ghost" label="Cancelar" onPress={() => router.back()} />
        <Button
          label={total > 0 ? `Criar ${total}` : 'Criar'}
          disabled={total === 0 || !page || !writable}
          onPress={confirm}
        />
      </View>
    </Screen>
  );
}

function PreviewRow({
  item,
  today,
  child,
  mentions,
  onChoose,
  onEdit,
  onRemove,
}: {
  item: BatchChild;
  today: string;
  child?: boolean;
  mentions: MentionResolution[];
  onChoose: (name: string, userId: string) => void;
  onEdit: (raw: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(item.raw);

  function save() {
    setEditing(false);
    if (raw.trim() && raw.trim() !== item.raw) onEdit(raw.trim());
  }
  const asTask = {
    due_date: item.dueDate,
    priority: item.priority,
    labels: item.labels,
    status: item.done ? 'done' : 'todo',
    recurrence: item.recurrence,
    meta: item.meta,
  } as Task;

  return (
    <View className={cn('min-h-12 flex-row items-center border-b border-border', child && 'pl-8')}>
      <Text className="w-6 text-muted-foreground">{item.done ? '✓' : '•'}</Text>
      <View className="flex-1 py-1">
        {editing ? (
          <TextInput
            autoFocus
            value={raw}
            onChangeText={setRaw}
            onBlur={save}
            onSubmitEditing={save}
            accessibilityLabel="Editar item"
            className="text-base text-foreground"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Toque para editar"
            onPress={() => setEditing(true)}
          >
            <Text
              className={cn(
                'text-base text-foreground',
                item.done && 'text-muted-foreground line-through',
              )}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
        <TaskMeta task={asTask} today={today} />
        <MentionChips mentions={mentions} onChoose={onChoose} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tirar ${item.title}`}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
        onPress={onRemove}
      >
        <Text className="text-lg text-muted-foreground">✕</Text>
      </Pressable>
    </View>
  );
}
