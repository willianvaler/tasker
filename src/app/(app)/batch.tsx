import { uuidv7 } from '@/lib/uuid';
import { isTouchScreen } from '@/lib/touch';
import { router } from 'expo-router';
import { Check, Dot, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ListPhotoButton } from '@/components/list-photo-button';
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
import { effectiveMaxDepth } from '@/config/limits';
import { countBatch, countFlattened, parseBatchInput, type BatchItem } from '@/lib/parser/batch';
import { rootFolder } from '@/lib/queries/projects';
import { parseQuickInput } from '@/lib/parser/quick';
import { setLastPageId } from '@/lib/prefs';
import type { MentionResolution } from '@/lib/members';
import { useMentions } from '@/lib/queries/mentions';
import { resolveBatchPrereq, type PrereqResolution } from '@/lib/prereqs';
import { useDependencyMutations, useProjectTaskOptions } from '@/lib/queries/dependencies';
import { useMentionAutocomplete } from '@/components/tasks/mention-autocomplete';
import { useToday } from '@/lib/queries/profile';
import { useCreateTasks, type Task } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { useShortcut } from '@/lib/use-shortcut';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

// Criação em lote: cola o texto, confere a pré-visualização, edita ou tira itens e confirma.
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
  // ^pré-requisito: em projeto ou pasta pessoal (CD16); hábito não
  const root = rootFolder(tree.data, page?.folder_id);
  const prereqsOn = !!root && page?.view_type !== 'habits';
  const inputRef = useRef<TextInput>(null);
  // Criar vai para a fila offline
  const writable = useCanWrite(page?.folder_id, { offline: true });

  // Limite de níveis da página: o que passar, sobe para o último nível (com aviso)
  const maxDepth = effectiveMaxDepth(
    page?.max_depth,
    rootFolder(tree.data, page?.folder_id)?.max_depth,
  );

  // Cada item tem uma chave pelo caminho na árvore ("3", "3.1", "3.1.2")
  const items = useMemo(() => {
    const parseOptions = {
      today,
      meta: isCards,
      mentions: mentions.enabled,
      prereqs: prereqsOn,
    };
    const decorate = (item: BatchItem, key: string): KeyedItem => ({
      ...item,
      ...(key in edits
        ? { ...parseQuickInput(edits[key], parseOptions), raw: edits[key], done: item.done }
        : {}),
      key,
      id: uuidv7(),
      children: item.children
        .map((c, j) => decorate(c, `${key}.${j}`))
        .filter((c) => !removed.has(c.key)),
    });
    return parseBatchInput(text, { ...parseOptions, maxDepth })
      .map((item, i) => decorate(item, `${i}`))
      .filter((item) => !removed.has(item.key));
  }, [text, edits, removed, today, isCards, mentions.enabled, prereqsOn, maxDepth]);
  const flattened = countFlattened(items);

  // ^pré-requisitos: cada item já tem id na prévia ("^2" aponta para o item 2 do lote); a
  // prévia e a criação usam os mesmos itens, então os ids batem
  const idOf = (key: string) => flat(items).find(({ item }) => item.key === key)?.item.id ?? '';
  const taskOptions = useProjectTaskOptions(root?.id, prereqsOn);
  const deps = useDependencyMutations(root?.id);
  const batchList = flat(items).map(({ item }) => ({ id: idOf(item.key), title: item.title }));
  const prereqsOf = (item: KeyedItem) =>
    item.prereqs.map((term) =>
      resolveBatchPrereq(term, idOf(item.key), batchList, taskOptions.data ?? []),
    );

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
  const withAssignees = (item: KeyedItem): NewBatchItem => ({
    ...item,
    assignees: assigneesOf(item.key, item.mentions),
    children: item.children.map(withAssignees),
  });

  const autocomplete = useMentionAutocomplete({
    enabled: mentions.enabled || prereqsOn,
    members: mentions.members,
    tasks: taskOptions.data,
    text,
    setText: (value) => changeText(value),
    inputRef,
    enterPicks: true,
  });

  function changeText(value: string) {
    setText(value);
    // As chaves dependem da posição; com o texto mudando, edições e remoções antigas não valem mais
    setRemoved(new Set());
    setEdits({});
    setChoices({});
  }

  function confirm() {
    if (!page || total === 0) return;
    const links = flat(items).flatMap(({ item }) =>
      prereqsOf(item).flatMap((p) =>
        p.kind === 'task' ? [{ taskId: idOf(item.key), dependsOn: p.id }] : [],
      ),
    );
    create.mutateAsync({ pageId: page.id, items: items.map(withAssignees) }).then(
      // As tarefas já existem: liga os pré-requisitos
      () => links.forEach((link) => deps.add.mutate(link)),
      (err: Error) => toast({ message: t('batch.error', { message: err.message }) }),
    );
    setLastPageId(page.id);
    toast({ message: t('batch.created', { count: total, page: pageLabel(page) }) });
    router.back();
  }

  // Ctrl/⌘+Enter confirma o lote sem tirar a mão do teclado
  useShortcut('form.save', () => {
    if (total === 0 || !page || !writable) return false;
    confirm();
  });

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
        ref={inputRef}
        multiline
        autoFocus={!draft.text && !isTouchScreen()}
        value={text}
        onChangeText={(value) => {
          changeText(value);
          autocomplete.onChangeText();
        }}
        onSelectionChange={autocomplete.onSelectionChange}
        onKeyPress={autocomplete.onKeyPress}
        aria-expanded={autocomplete.open}
        placeholder={t('batch.placeholder')}
        placeholderTextColor={colors['ink-muted']}
        accessibilityLabel={t('batch.list')}
        textAlignVertical="top"
        className={textClass(
          'max-h-48 min-h-28 rounded border border-line bg-surface p-3 text-base text-ink focus:border-accent md:text-sm',
        )}
      />
      {autocomplete.list}
      {/* V9 §3: foto de uma lista de papel; as linhas lidas entram no fim do texto */}
      {writable && (
        <ListPhotoButton
          onLines={(lines) => changeText([text.trimEnd(), ...lines].filter(Boolean).join('\n'))}
        />
      )}

      <Text
        className="mt-6 border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
        accessibilityLiveRegion="polite"
      >
        {total === 0 ? t('batch.none') : t('batch.willCreate', { count: total })}
      </Text>
      <ScreenScroll className="mt-1 flex-1" keyboardShouldPersistTaps="handled">
        {flattened > 0 && (
          <Text className="py-2 text-sm text-warn" accessibilityLiveRegion="polite">
            {t('batch.flattened', { count: flattened, max: maxDepth })}
          </Text>
        )}
        {flat(items).map(({ item, level }) => (
          <PreviewRow
            key={item.key}
            level={level}
            item={item}
            today={today}
            mentions={resolutionsOf(item.key, item.mentions)}
            onChoose={choose(item.key)}
            onEdit={(raw) => setEdits((e) => ({ ...e, [item.key]: raw }))}
            onRemove={() => setRemoved((r) => new Set(r).add(item.key))}
            prereqs={prereqsOf(item)}
          />
        ))}
      </ScreenScroll>

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

type KeyedItem = BatchItem & { key: string; id: string; children: KeyedItem[] };
type NewBatchItem = KeyedItem & {
  assignees: ReturnType<ReturnType<typeof useMentions>['toAssignees']>;
  children: NewBatchItem[];
};

/** A árvore em linhas, com o nível de cada uma (0 = raiz). */
const flat = (items: KeyedItem[], level = 0): { item: KeyedItem; level: number }[] =>
  items.flatMap((item) => [{ item, level }, ...flat(item.children, level + 1)]);

function PreviewRow({
  item,
  today,
  level,
  prereqs,
  mentions,
  onChoose,
  onEdit,
  onRemove,
}: {
  item: BatchItem;
  today: string;
  level: number;
  prereqs: PrereqResolution[];
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
      className="min-h-12 flex-row items-center gap-2 border-b border-line md:min-h-10"
      style={level ? { paddingLeft: level * 24 } : undefined}
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
        {prereqs.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {prereqs.map((p) => (
              <Text
                key={p.term}
                className={cn(
                  'font-mono text-xs',
                  p.kind === 'task' ? 'text-ink-muted' : 'text-warn',
                )}
              >
                {p.kind === 'task'
                  ? t('batch.dependsOn', { title: p.title })
                  : p.kind === 'ambiguous'
                    ? t('batch.prereqAmbiguous', { term: p.term })
                    : t('batch.prereqNone', { term: p.term })}
              </Text>
            ))}
          </View>
        )}
      </View>
      <IconButton icon={X} label={t('batch.remove', { title: item.title })} onPress={onRemove} />
    </View>
  );
}
