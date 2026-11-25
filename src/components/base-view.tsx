import { router } from 'expo-router';
import { ArrowDown, ArrowUp, ArrowUpRight, CircleAlert, Search } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { useErrorText, useQueryContext } from '@/components/note-query';
import { ScreenScroll } from '@/components/screen';
import { useToggleWithUndo } from '@/components/tasks/task-row';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Grid } from '@/components/ui/grid';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import {
  baseColumns,
  cellInput,
  type CellParse,
  DEFAULT_QUERY,
  EDITABLE,
  groupRows,
  isPropColumn,
  nextSort,
  NOTE_COLUMNS,
  notePropNames,
  parseCell,
  propName,
  propValue,
  readBaseConfig,
  showValue,
  sortRows,
  TASK_COLUMNS,
  toggleColumn,
  type BaseConfig,
} from '@/lib/base-config';
import { BaseSchemaEditor } from '@/components/base-schema';
import { cn } from '@/lib/cn';
import { applyRelation, computeRollup, defOf, parseTyped, relationIds } from '@/lib/relations';
import { readTask } from '@/lib/open-task';
import {
  computeTotal,
  defaultTotal,
  isNumberColumn,
  nextTotal,
  type TotalKind,
  type Totals,
} from '@/lib/totals';
import { actorCan } from '@/lib/permissions';
import { formatDueDate } from '@/lib/parser/dates';
import { isSelective, parseQuery, type Query, type Source } from '@/lib/query/parse';
import { fetchPlan, runNotes, runTasks, unknownNames, type QueryContext } from '@/lib/query/run';
import { useQueryTasks } from '@/lib/queries/note-query';
import { noteTitle, useNoteMutations, useNotes, type Note } from '@/lib/queries/notes';
import { useFolderActor } from '@/lib/queries/projects';
import { useUpdateTask, type Task, type TaskPatch, type TaskWithPage } from '@/lib/queries/tasks';
import { findFolder, pageLabel, useTree, useTreeMutations, type Page } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';
import { useCanWrite, useTaskCan } from '@/providers/write';

// Bases (OB8, ESCOPO_V11 §5, D293): a lista do tipo `base` mostra tarefas ou anotações filtradas
// pela consulta do OB7 em tabela (editar na célula, ordenar pelo cabeçalho, agrupar) ou cartões.

/** Linhas lidas por base (a consulta corta antes, com `limite`) */
const BASE_LIMIT = 500;

export function BaseView({ page }: { page: Page }) {
  const { t } = useTranslation();
  const toast = useToast();
  const m = useTreeMutations();
  const actor = useFolderActor(page.folder_id);
  const manage = useCanWrite(page.folder_id, { offline: true }) && actorCan(actor, 'page.manage');
  // A config guardada; mexer muda aqui na hora e grava em seguida
  const [draft, setDraft] = useState<BaseConfig | null>(null);
  const config = draft ?? readBaseConfig(page.config);
  const parsed = parseQuery(config.query || DEFAULT_QUERY);
  const source: Source = parsed.ok ? parsed.query.source : 'tasks';

  const save = (next: BaseConfig) => {
    setDraft(next);
    if (!manage) return;
    m.updatePage.mutate(
      { id: page.id, name: page.name, config: next },
      { onError: (err) => toast({ message: t('page.error', { message: err.message }) }) },
    );
  };

  return (
    <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-clear">
      <QueryEditor
        value={config.query || DEFAULT_QUERY}
        editable={manage}
        onSave={(query) => save({ ...config, query, sort: null })}
      />
      <BaseControls
        config={config}
        source={source}
        manage={manage}
        onChange={save}
        pageId={page.id}
      />
      <BaseResults config={config} onSort={save} />
    </ScreenScroll>
  );
}

function QueryEditor({
  value,
  editable,
  onSave,
}: {
  value: string;
  editable: boolean;
  onSave: (query: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  const current = text ?? value;
  const changed = text !== null && text.trim() !== value;
  if (!editable)
    return (
      <View className="flex-row items-center gap-2 rounded border border-line bg-wash px-3 py-2">
        <Icon icon={Search} size={16} tone="ink-muted" />
        <Text className="flex-1 font-mono text-xs text-ink-muted">{value}</Text>
      </View>
    );
  const apply = () => {
    if (!changed) return;
    onSave(current.trim());
    setText(null);
  };
  return (
    <View className="gap-2">
      <Input
        accessibilityLabel={t('base.query')}
        value={current}
        onChangeText={setText}
        multiline
        className="min-h-16 py-2 font-mono md:min-h-12 md:text-xs"
        onKeyPress={(e) => {
          // Ctrl/⌘+Enter aplica (Enter sozinho quebra a linha)
          const ev = e.nativeEvent as { key: string; ctrlKey?: boolean; metaKey?: boolean };
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) apply();
        }}
      />
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          label={t('base.apply')}
          onPress={apply}
          disabled={!changed}
          className="self-start"
        />
        <Text className="flex-1 text-xs text-ink-muted">{t('base.queryHint')}</Text>
      </View>
    </View>
  );
}

function useColumnLabel() {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    title: t('base.col.title'),
    list: t('base.col.list'),
    due: t('base.col.due'),
    priority: t('base.col.priority'),
    tags: t('base.col.tags'),
    status: t('base.col.status'),
    created: t('base.col.created'),
    completed: t('base.col.completed'),
    updated: t('base.col.updated'),
    folder: t('base.col.folder'),
  };
  return (column: string) => (isPropColumn(column) ? propName(column) : (labels[column] ?? column));
}

function BaseControls({
  config,
  source,
  manage,
  onChange,
  pageId,
}: {
  config: BaseConfig;
  source: Source;
  manage: boolean;
  onChange: (next: BaseConfig) => void;
  pageId: string;
}) {
  const { t } = useTranslation();
  const label = useColumnLabel();
  const notes = useNotes();
  const [open, setOpen] = useState<'columns' | 'group' | 'schema' | null>(null);
  const shown = baseColumns(config, source);
  const all: string[] =
    source === 'tasks'
      ? [...TASK_COLUMNS]
      : [
          ...NOTE_COLUMNS,
          ...notePropNames(notes.data ?? []).map((n) => `props.${n}`),
          // As do esquema (ED3), inclusive o rollup, que nenhuma anotação guarda
          ...Object.keys(config.schema).map((n) => `props.${n}`),
          // Coluna escolhida de uma propriedade que nenhuma anotação usa mais continua na lista
          ...shown.filter((c) => isPropColumn(c)),
        ].filter((c, i, list) => list.indexOf(c) === i);
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="radiogroup">
        <Chip
          role="radio"
          label={t('base.table')}
          selected={config.view === 'table'}
          onPress={() => onChange({ ...config, view: 'table' })}
        />
        <Chip
          role="radio"
          label={t('base.cards')}
          selected={config.view === 'cards'}
          onPress={() => onChange({ ...config, view: 'cards' })}
        />
        {manage && (
          <>
            <Chip
              label={t('base.columns')}
              selected={open === 'columns'}
              onPress={() => setOpen(open === 'columns' ? null : 'columns')}
            />
            <Chip
              label={
                config.group ? t('base.groupedBy', { name: label(config.group) }) : t('base.group')
              }
              selected={open === 'group'}
              onPress={() => setOpen(open === 'group' ? null : 'group')}
            />
            {source === 'notes' && (
              <Chip
                label={t('base.schema.open')}
                selected={open === 'schema'}
                onPress={() => setOpen(open === 'schema' ? null : 'schema')}
              />
            )}
          </>
        )}
      </View>
      {open === 'columns' && (
        <View className="flex-row flex-wrap gap-2" accessibilityLabel={t('base.columns')}>
          {all
            .filter((c) => c !== 'title')
            .map((c) => (
              <Chip
                key={c}
                role="checkbox"
                label={label(c)}
                selected={shown.includes(c)}
                onPress={() => onChange(toggleColumn(config, source, c))}
              />
            ))}
        </View>
      )}
      {open === 'schema' && (
        <BaseSchemaEditor
          schema={config.schema}
          pageId={pageId}
          onChange={(schema) => onChange({ ...config, schema })}
        />
      )}
      {open === 'group' && (
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('base.group')}
        >
          <Chip
            role="radio"
            label={t('base.noGroup')}
            selected={!config.group}
            onPress={() => onChange({ ...config, group: null })}
          />
          {all
            .filter((c) => c !== 'title')
            .map((c) => (
              <Chip
                key={c}
                role="radio"
                label={label(c)}
                selected={config.group === c}
                onPress={() => onChange({ ...config, group: c })}
              />
            ))}
        </View>
      )}
    </View>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded border border-line px-3 py-2"
    >
      <Icon icon={CircleAlert} size={16} tone="warn" />
      <Text className="flex-1 text-sm text-ink">{text}</Text>
    </View>
  );
}

function BaseResults({
  config,
  onSort,
}: {
  config: BaseConfig;
  onSort: (next: BaseConfig) => void;
}) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const tree = useTree();
  const parsed = parseQuery(config.query || DEFAULT_QUERY);
  if (!parsed.ok) return <Problem text={errorText(parsed.error)} />;
  if (!isSelective(parsed.query)) return <Problem text={t('query.notSelective')} />;
  if (!tree.data) return null;
  const pages = tree.data.pages.map((p) => ({ id: p.id, name: p.name }));
  const folders = tree.data.folders.flatMap((f) => [
    { id: f.id, name: f.name, parent_id: null as string | null },
    ...f.children.map((c) => ({ id: c.id, name: c.name, parent_id: f.id as string | null })),
  ]);
  const missing = unknownNames(parsed.query, pages, folders);
  if (missing.length) return <Problem text={t('query.unknown', { names: missing.join(', ') })} />;
  const query: Query = { ...parsed.query, limit: parsed.query.limit ?? BASE_LIMIT };
  return query.source === 'tasks' ? (
    <TaskBase query={query} config={config} pages={pages} folders={folders} onSort={onSort} />
  ) : (
    <NoteBase query={query} config={config} folders={folders} onSort={onSort} />
  );
}

type Named = { id: string; name: string };
export type Row = {
  id: string;
  kind: 'task' | 'note';
  task?: Task;
  note?: Note;
  /** Valor bruto de cada coluna (ordenar, agrupar, editar) */
  value: (column: string) => unknown;
  /** Texto da célula */
  show: (column: string) => string;
};

function useShow(ctx: QueryContext) {
  const { t } = useTranslation();
  const status: Record<string, string> = {
    todo: t('base.status.todo'),
    doing: t('base.status.doing'),
    done: t('base.status.done'),
  };
  return (column: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    if (column === 'due' || column === 'created' || column === 'completed' || column === 'updated')
      return typeof value === 'string' ? formatDueDate(value, ctx.today) : '';
    if (column === 'priority') return value ? '!'.repeat(Number(value)) : '';
    if (column === 'tags' && Array.isArray(value)) return value.map((v) => `#${v}`).join(' ');
    if (column === 'status') return status[String(value)] ?? String(value);
    return showValue(value);
  };
}

function TaskBase({
  query,
  config,
  pages,
  folders,
  onSort,
}: {
  query: Query;
  config: BaseConfig;
  pages: Named[];
  folders: (Named & { parent_id: string | null })[];
  onSort: (next: BaseConfig) => void;
}) {
  const { t } = useTranslation();
  const ctx = useQueryContext();
  const show = useShow(ctx);
  const plan = fetchPlan(query, ctx, pages, folders);
  const tasks = useQueryTasks(plan);
  const update = useUpdateTask();
  if (tasks.error)
    return <Problem text={t('common.loadError', { message: tasks.error.message })} />;
  if (!tasks.data) return <Text className="py-2 text-sm text-ink-muted">{t('query.loading')}</Text>;
  const scope =
    plan.by === 'pages'
      ? { pageIds: plan.ids }
      : plan.by === 'folders'
        ? { folderIds: plan.ids }
        : {};
  const byId = new Map(tasks.data.map((task) => [task.id, task]));
  const result = runTasks(tasks.data, query, ctx, scope);
  const valueOf = (task: TaskWithPage, column: string): unknown => {
    switch (column) {
      case 'title':
        return task.title;
      case 'list':
        return task.page ? pageLabel(task.page) : '';
      case 'due':
        return task.due_date;
      case 'priority':
        return task.priority;
      case 'tags':
        return task.labels ?? [];
      case 'status':
        return task.status;
      case 'created':
        return ctx.dayOf(task.created_at);
      case 'completed':
        return task.completed_at ? ctx.dayOf(task.completed_at) : null;
      default:
        return undefined;
    }
  };
  const rows: Row[] = result.rows.flatMap((r) => {
    const task = byId.get(r.id);
    if (!task) return [];
    return [
      {
        id: task.id,
        kind: 'task' as const,
        task,
        value: (c: string) => valueOf(task, c),
        show: (c: string) => show(c, valueOf(task, c)),
      },
    ];
  });
  const save = (row: Row, column: string, value: unknown) => {
    if (!row.task) return;
    const field: Record<string, keyof TaskPatch> = {
      title: 'title',
      due: 'due_date',
      priority: 'priority',
      tags: 'labels',
    };
    const key = field[column];
    if (key) update.mutate({ id: row.task.id, patch: { [key]: value } as TaskPatch });
  };
  return (
    <BaseBody
      source="tasks"
      rows={rows}
      total={result.total}
      config={config}
      onSort={onSort}
      onSave={save}
    />
  );
}

/** As anotações que uma base mostra (a de destino de uma relação, ED3) */
function notesOfBase(
  page: Page,
  notes: Note[],
  ctx: QueryContext,
  folders: (Named & { parent_id: string | null })[],
): Note[] {
  const parsed = parseQuery(readBaseConfig(page.config).query || DEFAULT_QUERY);
  if (!parsed.ok || parsed.query.source !== 'notes') return notes;
  const plan = fetchPlan(parsed.query, ctx, [], folders);
  const ids = new Set(
    runNotes(
      notes,
      { ...parsed.query, limit: 5000 },
      ctx,
      plan.by === 'folders' ? { folderIds: plan.ids } : {},
    ).rows.map((r) => r.id),
  );
  return notes.filter((n) => ids.has(n.id));
}

function NoteBase({
  query,
  config,
  folders,
  onSort,
}: {
  query: Query;
  config: BaseConfig;
  folders: (Named & { parent_id: string | null })[];
  onSort: (next: BaseConfig) => void;
}) {
  const { t } = useTranslation();
  const ctx = useQueryContext();
  const show = useShow(ctx);
  const notes = useNotes();
  const tree = useTree();
  const { update } = useNoteMutations();
  const toast = useToast();
  const tree2 = tree.data;
  if (!notes.data) return null;
  const plan = fetchPlan(query, ctx, [], folders);
  const result = runNotes(
    notes.data,
    query,
    ctx,
    plan.by === 'folders' ? { folderIds: plan.ids } : {},
  );
  const byId = new Map(notes.data.map((n) => [n.id, n]));
  const schema = config.schema;
  const valueOf = (note: Note, column: string): unknown => {
    if (isPropColumn(column)) {
      const def = defOf(schema, propName(column));
      // Rollup: calculado aqui, nunca gravado (D318); relação: os títulos de agora
      if (def?.tipo === 'rollup') {
        const r = computeRollup(note, def, byId);
        return r.ok ? r.value : t(`base.schema.err_${r.erro}`);
      }
      const v = propValue(note.props, propName(column));
      if (def?.tipo === 'relacao')
        return relationIds(v).map((id) => {
          const n = byId.get(id);
          return n ? noteTitle(n, t('notes.untitled')) : t('base.schema.unavailable');
        });
      return v;
    }
    switch (column) {
      case 'title':
        return noteTitle(note, t('notes.untitled'));
      case 'tags':
        return note.tags ?? [];
      case 'folder':
        return note.folder_id ? (findFolder(tree.data, note.folder_id)?.folder.name ?? '') : '';
      case 'created':
        return ctx.dayOf(note.created_at);
      case 'updated':
        return ctx.dayOf(note.updated_at);
      default:
        return undefined;
    }
  };
  const rows: Row[] = result.rows.flatMap((r) => {
    const note = byId.get(r.id);
    if (!note) return [];
    return [
      {
        id: note.id,
        kind: 'note' as const,
        note,
        value: (c: string) => valueOf(note, c),
        show: (c: string) => show(c, valueOf(note, c)),
      },
    ];
  });
  const save = (row: Row, column: string, value: unknown) => {
    const note = row.note;
    if (!note) return;
    if (column === 'title') update.mutate({ id: note.id, title: String(value) });
    else if (isPropColumn(column) && defOf(schema, propName(column))?.tipo === 'relacao') {
      const def = defOf(schema, propName(column));
      const r = applyRelation(
        notes.data ?? [],
        note.id,
        propName(column),
        (value as string[] | null) ?? [],
        def?.inversa,
      );
      if (!r.ok) {
        toast({ message: t('base.schema.tooMany') });
        return;
      }
      for (const p of r.patches) update.mutate({ id: p.id, props: p.props as never });
    } else if (isPropColumn(column)) {
      const name = propName(column);
      const key = Object.keys(note.props ?? {}).find((k) => k.toLowerCase() === name.toLowerCase());
      const props = { ...(note.props ?? {}) };
      if (value === null) delete props[key ?? name];
      else props[key ?? name] = value as never;
      update.mutate({ id: note.id, props });
    }
  };
  return (
    <BaseBody
      source="notes"
      rows={rows}
      total={result.total}
      config={config}
      onSort={onSort}
      onSave={save}
      typed={{
        editable: (c) => !(isPropColumn(c) && defOf(schema, propName(c))?.tipo === 'rollup'),
        parse: (c, text, current) => {
          const def = isPropColumn(c) ? defOf(schema, propName(c)) : undefined;
          if (!def) return parseCell(c, text, current);
          // Relação: os candidatos são as anotações da base de destino (ou todas, sem destino)
          const alvo = def.base ? tree2?.pages.find((p) => p.id === def.base) : undefined;
          const candidatos = alvo
            ? notesOfBase(alvo, notes.data ?? [], ctx, folders)
            : (notes.data ?? []);
          const r = parseTyped(
            def,
            text,
            candidatos.map((n) => ({ ...n, title: noteTitle(n, '') })),
          );
          return r.ok ? { ok: true, value: r.value } : { ok: false };
        },
      }}
    />
  );
}

function BaseBody({
  source,
  rows,
  total,
  config,
  onSort,
  onSave,
  typed,
}: {
  source: Source;
  rows: Row[];
  total: number;
  config: BaseConfig;
  onSort: (next: BaseConfig) => void;
  onSave: (row: Row, column: string, value: unknown) => void;
  /** As propriedades tipadas (ED3): o que se edita e como o texto vira valor */
  typed?: Pick<TableOptions, 'editable' | 'parse'>;
}) {
  const { t } = useTranslation();
  const columns = baseColumns(config, source);
  const sort = config.sort;
  const sorted = sort ? sortRows(rows, (r) => r.value(sort.column), sort.desc) : rows;
  const group = config.group;
  const groups = group
    ? groupRows(
        sorted,
        (r) => {
          const v = r.value(group);
          return Array.isArray(v) ? v.map(String) : r.show(group);
        },
        group === 'priority' ? (k) => -k.length : undefined,
      )
    : [{ key: '', rows: sorted }];
  const label = useColumnLabel();
  const status: Record<string, string> = {
    todo: t('base.status.todo'),
    doing: t('base.status.doing'),
    done: t('base.status.done'),
  };
  return (
    <View className="gap-2">
      <Text testID="base-count" className="text-xs text-ink-muted">
        {source === 'tasks'
          ? t('query.countTasks', { count: total })
          : t('query.countNotes', { count: total })}
      </Text>
      {rows.length === 0 ? (
        <Text className="py-2 text-sm text-ink-muted">{t('query.none')}</Text>
      ) : config.view === 'table' ? (
        <BaseTable
          source={source}
          columns={columns}
          groups={group ? groups : null}
          emptyGroup={group ? t('base.empty', { name: label(group) }) : ''}
          rows={sorted}
          sort={config.sort}
          onHeader={(c) => onSort({ ...config, sort: nextSort(config.sort, c) })}
          onSave={onSave}
          options={{
            ...typed,
            totals: config.totals,
            onTotal: (c, total) => onSort({ ...config, totals: { ...config.totals, [c]: total } }),
            formatValue: (c, v) => (c === 'tags' ? `#${v}` : c === 'status' ? (status[v] ?? v) : v),
          }}
        />
      ) : (
        groups.map((g) => (
          <View key={g.key || '-'} className="gap-2">
            {group && (
              <SectionLabel
                title={
                  g.key
                    ? group === 'tags'
                      ? `#${g.key}`
                      : g.key
                    : t('base.empty', { name: label(group) })
                }
                count={g.rows.length}
              />
            )}
            <Grid breakpoints={[560, 900, 1300]}>
              {g.rows.map((row) => (
                <BaseCard key={row.id} row={row} columns={columns} />
              ))}
            </Grid>
          </View>
        ))
      )}
      {total > rows.length && (
        <Text className="text-xs text-ink-muted">
          {t('query.showing', { shown: rows.length, total })}
        </Text>
      )}
    </View>
  );
}

const width = (column: string) => (column === 'title' ? 280 : column === 'tags' ? 180 : 140);

function openRow(row: Row) {
  if (row.kind === 'task') readTask(row.id);
  else router.push({ pathname: '/nota/[id]', params: { id: row.id } });
}

/**
 * O que muda quando a tabela não é de uma base: a visão Tabela de uma lista (VS1) tem colunas de
 * campo personalizado, com nome e leitura próprios.
 */
export type TableOptions = {
  /** Totais escolhidos por coluna (VS2); sem eles, o padrão (soma no número) */
  totals?: Totals;
  /** Trocou o total de uma coluna (quem pode, grava); sem isso, a troca é só desta tela */
  onTotal?: (column: string, total: TotalKind) => void;
  /** Número do total em texto (moeda, por exemplo) */
  formatTotal?: (column: string, value: number) => string;
  /** Um valor contado ("Obra", o nome do estado) em texto */
  formatValue?: (column: string, value: string) => string;
  label?: (column: string) => string;
  editable?: (column: string) => boolean;
  parse?: (column: string, text: string, current: unknown) => CellParse;
  input?: (column: string, value: unknown) => string;
};

/** A tabela das Bases (OB8), usada também pela visão Tabela da lista (VS1). */
export function BaseTable({
  source,
  columns,
  groups,
  emptyGroup,
  rows,
  sort,
  onHeader,
  onSave,
  options,
}: {
  source: Source;
  columns: string[];
  groups: { key: string; rows: Row[] }[] | null;
  emptyGroup: string;
  rows: Row[];
  sort: BaseConfig['sort'];
  onHeader: (column: string) => void;
  onSave: (row: Row, column: string, value: unknown) => void;
  options?: TableOptions;
}) {
  const { t } = useTranslation();
  const baseLabel = useColumnLabel();
  const label = options?.label ?? baseLabel;
  const lead = source === 'tasks' ? 44 : 0;
  const total = lead + columns.reduce((sum, c) => sum + width(c), 0) + 44;
  const line = (row: Row) =>
    row.task ? (
      <TaskLine
        key={row.id}
        row={row}
        task={row.task}
        columns={columns}
        onSave={onSave}
        options={options}
      />
    ) : (
      <Line
        key={row.id}
        row={row}
        source={source}
        columns={columns}
        canEdit
        onSave={onSave}
        options={options}
      />
    );
  return (
    <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
      <View
        role="table"
        style={{ minWidth: total, flexGrow: 1 }}
        className="rounded border border-line"
      >
        <View role="row" className="flex-row border-b border-line bg-wash">
          {lead > 0 && <View style={{ width: lead }} />}
          {columns.map((c) => {
            const active = sort?.column === c;
            return (
              <Pressable
                key={c}
                role="columnheader"
                aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                accessibilityLabel={t('base.sortBy', { name: label(c) })}
                onPress={() => onHeader(c)}
                style={{ width: width(c), flexGrow: c === 'title' ? 1 : 0 }}
                className="flex-row items-center gap-1 px-3 py-2"
              >
                <Text
                  numberOfLines={1}
                  className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {label(c)}
                </Text>
                {active && (
                  <Icon icon={sort.desc ? ArrowDown : ArrowUp} size={16} tone="ink-muted" />
                )}
              </Pressable>
            );
          })}
          <View style={{ width: 44 }} />
        </View>
        {groups
          ? groups.map((g) => (
              <View key={g.key || '-'}>
                <View className="flex-row items-center gap-2 border-b border-line bg-wash/50 px-3 py-1">
                  <Text className="text-xs font-semibold text-ink">{g.key || emptyGroup}</Text>
                  <Text className="text-xs text-ink-muted">{g.rows.length}</Text>
                </View>
                {g.rows.map(line)}
              </View>
            ))
          : rows.map(line)}
        <TotalsRow columns={columns} rows={rows} lead={lead} label={label} options={options} />
      </View>
    </ScrollView>
  );
}

/** Rodapé com o total de cada coluna (VS2): tocar troca soma, média, mínimo, máximo, contagem. */
function TotalsRow({
  columns,
  rows,
  lead,
  label,
  options,
}: {
  columns: string[];
  rows: Row[];
  lead: number;
  label: (column: string) => string;
  options?: TableOptions;
}) {
  const { t, i18n } = useTranslation();
  const [local, setLocal] = useState<Totals>({});
  const number = (column: string, n: number) =>
    options?.formatTotal?.(column, n) ??
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(n);
  const name: Record<string, string> = {
    sum: t('totals.sum'),
    avg: t('totals.avg'),
    min: t('totals.min'),
    max: t('totals.max'),
    count: t('totals.count'),
    values: t('totals.values'),
    none: t('totals.none'),
  };
  if (!rows.length) return null;
  return (
    <View role="row" className="flex-row items-start border-t border-line bg-wash">
      {lead > 0 && <View style={{ width: lead }} />}
      {columns.map((c) => {
        const values = rows.map((r) => r.value(c));
        const numeric = isNumberColumn(values);
        const chosen = local[c] ?? options?.totals?.[c] ?? defaultTotal(values);
        const result = computeTotal(values, chosen);
        const text =
          result.kind === 'none'
            ? ''
            : result.kind === 'values'
              ? result.counts
                  .slice(0, 4)
                  .map((v) => `${options?.formatValue?.(c, v.value) ?? v.value} ${v.count}`)
                  .join(' · ')
              : result.value === null
                ? '—'
                : `${name[result.total]} ${result.total === 'count' ? result.value : number(c, result.value)}`;
        return (
          <Pressable
            key={c}
            role="cell"
            accessibilityLabel={t('totals.cell', { name: label(c), value: text || name.none })}
            accessibilityHint={t('totals.hint')}
            onPress={() => {
              const next = nextTotal(chosen, numeric);
              setLocal((m) => ({ ...m, [c]: next }));
              options?.onTotal?.(c, next);
            }}
            style={{ width: width(c), flexGrow: c === 'title' ? 1 : 0 }}
            className="min-h-9 justify-center px-3 py-2 hover:bg-line"
          >
            <Text
              numberOfLines={2}
              className={cn('font-mono text-xs', text ? 'text-ink' : 'text-ink-muted')}
            >
              {text || name.none}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ width: 44 }} />
    </View>
  );
}

function TaskLine({
  row,
  task,
  columns,
  onSave,
  options,
}: {
  row: Row;
  task: Task;
  columns: string[];
  onSave: (row: Row, column: string, value: unknown) => void;
  options?: TableOptions;
}) {
  const can = useTaskCan(task);
  return (
    <Line
      row={row}
      source="tasks"
      columns={columns}
      canEdit={can.edit}
      lead={<TaskCheck task={task} canComplete={can.complete} />}
      onSave={onSave}
      options={options}
    />
  );
}

function Line({
  row,
  source,
  columns,
  canEdit,
  lead,
  onSave,
  options,
}: {
  row: Row;
  source: Source;
  columns: string[];
  canEdit: boolean;
  lead?: ReactNode;
  onSave: (row: Row, column: string, value: unknown) => void;
  options?: TableOptions;
}) {
  const { t } = useTranslation();
  return (
    <View role="row" className="flex-row items-center border-b border-line hover:bg-wash">
      {lead}
      {columns.map((c) => (
        <Cell
          key={c}
          row={row}
          column={c}
          source={source}
          canEdit={canEdit}
          onSave={onSave}
          options={options}
        />
      ))}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('base.open', { title: row.show('title') })}
        onPress={() => openRow(row)}
        className="h-9 w-11 items-center justify-center"
      >
        <Icon icon={ArrowUpRight} size={16} tone="ink-muted" />
      </Pressable>
    </View>
  );
}

function TaskCheck({ task, canComplete }: { task: Task; canComplete: boolean }) {
  const { t } = useTranslation();
  const toggle = useToggleWithUndo();
  const done = task.status === 'done';
  return (
    <View style={{ width: 44 }} className="items-center">
      <Checkbox
        checked={done}
        disabled={!canComplete}
        label={t(done ? 'task.reopen' : 'task.complete', { title: task.title })}
        onChange={(checked) => toggle(task, checked)}
      />
    </View>
  );
}

function CardCheck({ task }: { task: Task }) {
  const can = useTaskCan(task);
  return <TaskCheck task={task} canComplete={can.complete} />;
}

/** Célula: tocar edita (as colunas que dá para editar); Enter grava, Esc desiste */
function Cell({
  row,
  column,
  source,
  canEdit,
  onSave,
  options,
}: {
  row: Row;
  column: string;
  source: Source;
  canEdit: boolean;
  onSave: (row: Row, column: string, value: unknown) => void;
  options?: TableOptions;
}) {
  const { t } = useTranslation();
  const baseLabel = useColumnLabel();
  const label = options?.label ?? baseLabel;
  const toast = useToast();
  const editable =
    canEdit &&
    (options?.editable
      ? options.editable(column)
      : EDITABLE[source].includes(column) || (source === 'notes' && isPropColumn(column)));
  const [editing, setEditing] = useState<string | null>(null);
  const style = { width: width(column), flexGrow: column === 'title' ? 1 : 0 };
  const text = row.show(column);
  const raw = row.value(column);
  // Caixinha numa propriedade booleana: um toque troca
  if (source === 'notes' && isPropColumn(column) && typeof raw === 'boolean')
    return (
      <View role="cell" style={style} className="px-1">
        <Checkbox
          checked={raw}
          label={`${label(column)}: ${row.show('title')}`}
          onChange={(checked) => onSave(row, column, checked)}
        />
      </View>
    );
  if (editing !== null) {
    const commit = () => {
      const result = (options?.parse ?? parseCell)(column, editing, raw);
      setEditing(null);
      if (!result.ok) {
        toast({ message: t('base.invalid', { name: label(column) }) });
        return;
      }
      if (JSON.stringify(result.value) !== JSON.stringify(raw ?? null))
        onSave(row, column, result.value);
    };
    return (
      <View role="cell" style={style} className="px-1 py-1">
        <TextInput
          autoFocus
          accessibilityLabel={`${label(column)}: ${row.show('title')}`}
          value={editing}
          onChangeText={setEditing}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder={column === 'due' ? 'AAAA-MM-DD' : undefined}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Escape') setEditing(null);
          }}
          className="min-h-8 rounded border border-accent bg-surface px-2 font-sans text-sm text-ink"
          {...(Platform.OS === 'web' ? ({ blurOnSubmit: true } as object) : {})}
        />
      </View>
    );
  }
  const body = (
    <Text
      numberOfLines={1}
      className={cn(
        'text-sm',
        column === 'title' ? 'text-ink' : 'text-ink-muted',
        column === 'title' && row.task?.status === 'done' && 'text-ink-muted line-through',
      )}
    >
      {text || ' '}
    </Text>
  );
  if (!editable)
    return (
      <View role="cell" style={style} className="px-3 py-2">
        {body}
      </View>
    );
  return (
    <Pressable
      role="cell"
      accessibilityHint={t('base.editHint')}
      accessibilityLabel={`${label(column)}: ${text || t('base.blank')}`}
      onPress={() => setEditing((options?.input ?? cellInput)(column, raw))}
      style={style}
      className="min-h-9 justify-center px-3 py-2 hover:bg-wash"
    >
      {body}
    </Pressable>
  );
}

function BaseCard({ row, columns }: { row: Row; columns: string[] }) {
  const label = useColumnLabel();
  return (
    <View className="gap-1 rounded-lg border border-line bg-surface p-3">
      <View className="flex-row items-center gap-1">
        {row.task && <CardCheck task={row.task} />}
        <Pressable
          accessibilityRole="link"
          onPress={() => openRow(row)}
          className="min-h-9 flex-1 justify-center"
        >
          <Text
            numberOfLines={2}
            className={cn(
              'font-semibold text-ink',
              row.task?.status === 'done' && 'text-ink-muted line-through',
            )}
          >
            {row.show('title')}
          </Text>
        </Pressable>
      </View>
      {columns
        .filter((c) => c !== 'title' && row.show(c))
        .map((c) => (
          <View key={c} className="flex-row gap-2">
            <Text className="w-24 text-xs uppercase tracking-wide text-ink-muted">{label(c)}</Text>
            <Text numberOfLines={2} className="flex-1 text-sm text-ink">
              {row.show(c)}
            </Text>
          </View>
        ))}
    </View>
  );
}
