import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Check, Dot, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { MentionChips } from '@/components/tasks/assignee-chips';
import { TaskMeta } from '@/components/tasks/task-meta';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text, textClass } from '@/components/ui/text';
import { takeBatchDraft } from '@/lib/batch-draft';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/tokens';
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
  const { t } = useTranslation();
  const colors = useColors();
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
      { onError: (err) => toast({ message: t('batch.error', { message: err.message }) }) },
    );
    setLastPageId(page.id);
    toast({ message: t('batch.created', { count: total, page: pageLabel(page) }) });
    router.back();
  }

  if (!draft) {
    return (
      <Screen>
        <ScreenHeader title={t('batch.title')} back />
        <EmptyState title={t('batch.noDraft')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('batch.title')} back />
      <Text className="mb-2 font-mono text-xs text-ink-muted">
        {t('batch.where', { page: page ? pageLabel(page) : '…' })}
      </Text>
      <TextInput
        multiline
        autoFocus={!draft.text}
        value={text}
        onChangeText={changeText}
        placeholder={t('batch.placeholder')}
        placeholderTextColor={colors['ink-muted']}
        accessibilityLabel={t('batch.list')}
        textAlignVertical="top"
        className={textClass(
          'max-h-48 min-h-28 rounded border border-line bg-surface p-3 text-base text-ink focus:border-accent md:text-sm',
        )}
      />

      <Text
        className="mt-6 border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
        accessibilityLiveRegion="polite"
      >
        {total === 0 ? t('batch.none') : t('batch.willCreate', { count: total })}
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
        <Button variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
        <Button
          label={total > 0 ? t('batch.createN', { count: total }) : t('batch.create')}
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
  const { t } = useTranslation();
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
    <View
      className={cn(
        'min-h-12 flex-row items-center gap-2 border-b border-line md:min-h-10',
        child && 'pl-8',
      )}
    >
      <Icon icon={item.done ? Check : Dot} tone={item.done ? 'accent' : 'ink-muted'} />
      <View className="flex-1 py-1">
        {editing ? (
          <TextInput
            autoFocus
            value={raw}
            onChangeText={setRaw}
            onBlur={save}
            onSubmitEditing={save}
            accessibilityLabel={t('batch.edit')}
            className={textClass('text-base text-ink md:text-sm')}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={t('batch.editHint')}
            onPress={() => setEditing(true)}
          >
            <Text
              className={cn(
                'text-base text-ink md:text-sm',
                item.done && 'text-ink-muted line-through',
              )}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
        <TaskMeta task={asTask} today={today} />
        <MentionChips mentions={mentions} onChoose={onChoose} />
      </View>
      <IconButton icon={X} label={t('batch.remove', { title: item.title })} onPress={onRemove} />
    </View>
  );
}
