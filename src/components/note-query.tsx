import { router } from 'expo-router';
import { CircleAlert, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { TaskRow } from '@/components/tasks/task-row';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDueDate, todayIn } from '@/lib/parser/dates';
import { isSelective, parseQuery, type Query, type QueryError } from '@/lib/query/parse';
import {
  fetchPlan,
  propColumns,
  propOf,
  runNotes,
  runTasks,
  unknownNames,
  type QueryContext,
} from '@/lib/query/run';
import { useQueryTasks } from '@/lib/queries/note-query';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import type { TaskWithPage } from '@/lib/queries/tasks';
import { pageLabel, useTree } from '@/lib/queries/tree';

/**
 * Bloco ```questlist (OB7, D292): a consulta escrita na anotação, com o resultado em lista
 * (tarefas com a caixinha de verdade), tabela ou contagem. Sem filtro seletivo, avisa e não roda.
 */
export function QueryBlock({ source }: { source: string }) {
  const { t } = useTranslation();
  const parsed = parseQuery(source);
  const errorText = useErrorText();
  return (
    <View testID="note-query" className="my-1 overflow-hidden rounded-lg border border-line">
      <View className="flex-row items-center gap-2 border-b border-line bg-wash px-3 py-1">
        <Icon icon={Search} size={16} tone="ink-muted" />
        <Text numberOfLines={2} className="flex-1 font-mono text-xs text-ink-muted">
          {source || t('query.title')}
        </Text>
      </View>
      {!parsed.ok ? (
        <Problem text={errorText(parsed.error)} />
      ) : !isSelective(parsed.query) ? (
        <Problem text={t('query.notSelective')} />
      ) : (
        <Results query={parsed.query} />
      )}
    </View>
  );
}

function useErrorText() {
  const { t } = useTranslation();
  return (error: QueryError) => {
    const word = 'word' in error ? error.word : '';
    switch (error.code) {
      case 'empty':
        return t('query.errors.empty');
      case 'notesDone':
        return t('query.errors.notesDone');
      case 'source':
        return t('query.errors.source', { word });
      case 'field':
        return t('query.errors.field', { word });
      case 'operator':
        return t('query.errors.operator', { word });
      case 'value':
        return t('query.errors.value', { word });
      case 'limit':
        return t('query.errors.limit', { word });
      case 'view':
        return t('query.errors.view', { word });
      case 'unexpected':
        return t('query.errors.unexpected', { word });
    }
  };
}

function Problem({ text }: { text: string }) {
  return (
    <View accessibilityRole="alert" className="flex-row items-start gap-2 px-3 py-2">
      <Icon icon={CircleAlert} size={16} tone="warn" />
      <Text className="flex-1 text-sm text-ink">{text}</Text>
    </View>
  );
}

function Results({ query }: { query: Query }) {
  const { t } = useTranslation();
  const tree = useTree();
  const pages = (tree.data?.pages ?? []).map((p) => ({ id: p.id, name: p.name }));
  const folders = (tree.data?.folders ?? []).flatMap((f) => [
    { id: f.id, name: f.name, parent_id: null as string | null },
    ...f.children.map((c) => ({ id: c.id, name: c.name, parent_id: f.id as string | null })),
  ]);
  if (!tree.data) return null;
  const missing = unknownNames(query, pages, folders);
  if (missing.length) return <Problem text={t('query.unknown', { names: missing.join(', ') })} />;
  return query.source === 'tasks' ? (
    <TaskResults query={query} pages={pages} folders={folders} />
  ) : (
    <NoteResults query={query} folders={folders} />
  );
}

function useQueryContext(): QueryContext {
  const today = useToday();
  const timeZone = useTimeZone();
  return { today, dayOf: (iso) => todayIn(timeZone, new Date(iso.replace(' ', 'T'))) };
}

type Named = { id: string; name: string };

function TaskResults({
  query,
  pages,
  folders,
}: {
  query: Query;
  pages: Named[];
  folders: (Named & { parent_id: string | null })[];
}) {
  const { t } = useTranslation();
  const ctx = useQueryContext();
  const plan = fetchPlan(query, ctx, pages, folders);
  const tasks = useQueryTasks(plan);
  if (tasks.error)
    return <Problem text={t('common.loadError', { message: tasks.error.message })} />;
  if (!tasks.data)
    return <Text className="px-3 py-2 text-sm text-ink-muted">{t('query.loading')}</Text>;
  const scope =
    plan.by === 'pages'
      ? { pageIds: plan.ids }
      : plan.by === 'folders'
        ? { folderIds: plan.ids }
        : {};
  const byId = new Map(tasks.data.map((task) => [task.id, task]));
  const result = runTasks(tasks.data, query, ctx, scope);
  const rows = result.rows.map((r) => byId.get(r.id)).filter((x): x is TaskWithPage => !!x);
  if (query.view === 'count')
    return <Count text={t('query.countTasks', { count: result.total })} />;
  return (
    <>
      {rows.length === 0 && (
        <Text className="px-3 py-2 text-sm text-ink-muted">{t('query.none')}</Text>
      )}
      {query.view === 'table' ? (
        <Table
          columns={[
            t('query.col.title'),
            t('query.col.list'),
            t('query.col.due'),
            t('query.col.priority'),
            t('query.col.tags'),
          ]}
          rows={rows.map((task) => ({
            id: task.id,
            onPress: () => router.push({ pathname: '/task/[id]', params: { id: task.id } }),
            cells: [
              task.status === 'done' ? `☑ ${task.title}` : task.title,
              task.page ? pageLabel(task.page) : '',
              task.due_date ? formatDueDate(task.due_date, ctx.today) : '',
              task.priority ? '!'.repeat(task.priority) : '',
              (task.labels ?? []).map((l) => `#${l}`).join(' '),
            ],
          }))}
        />
      ) : (
        rows.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            today={ctx.today}
            pageLabel={task.page ? pageLabel(task.page) : undefined}
          />
        ))
      )}
      <More shown={rows.length} total={result.total} />
    </>
  );
}

function NoteResults({
  query,
  folders,
}: {
  query: Query;
  folders: (Named & { parent_id: string | null })[];
}) {
  const { t } = useTranslation();
  const ctx = useQueryContext();
  const notes = useNotes();
  if (!notes.data) return null;
  const plan = fetchPlan(query, ctx, [], folders);
  const result = runNotes(
    notes.data,
    query,
    ctx,
    plan.by === 'folders' ? { folderIds: plan.ids } : {},
  );
  if (query.view === 'count')
    return <Count text={t('query.countNotes', { count: result.total })} />;
  const open = (id: string) => router.push({ pathname: '/nota/[id]', params: { id } });
  const props = propColumns(query);
  const show = (value: unknown) =>
    value === null || value === undefined
      ? ''
      : Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'boolean'
          ? value
            ? '☑'
            : '☐'
          : String(value);
  return (
    <>
      {result.rows.length === 0 && (
        <Text className="px-3 py-2 text-sm text-ink-muted">{t('query.none')}</Text>
      )}
      {query.view === 'table' ? (
        <Table
          columns={[t('query.col.title'), t('query.col.tags'), ...props]}
          rows={result.rows.map((note) => ({
            id: note.id,
            onPress: () => open(note.id),
            cells: [
              noteTitle(note, t('notes.untitled')),
              (note.tags ?? []).map((tag) => `#${tag}`).join(' '),
              ...props.map((p) => show(propOf(note.props, p))),
            ],
          }))}
        />
      ) : (
        result.rows.map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole="link"
            onPress={() => open(note.id)}
            className="min-h-9 justify-center border-b border-line px-3 py-1 hover:bg-wash"
          >
            <Text numberOfLines={1} className="text-sm text-ink">
              {noteTitle(note, t('notes.untitled'))}
            </Text>
          </Pressable>
        ))
      )}
      <More shown={result.rows.length} total={result.total} />
    </>
  );
}

function Count({ text }: { text: string }) {
  return (
    <Text testID="query-count" className="px-3 py-3 font-serif text-xl text-ink">
      {text}
    </Text>
  );
}

function More({ shown, total }: { shown: number; total: number }) {
  const { t } = useTranslation();
  if (total <= shown) return null;
  return (
    <Text className="px-3 py-2 text-xs text-ink-muted">{t('query.showing', { shown, total })}</Text>
  );
}

/** Tabela simples: rola de lado quando não cabe; tocar na linha abre o item */
function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: { id: string; onPress: () => void; cells: string[] }[];
}) {
  const width = Math.max(columns.length * 140, 0);
  return (
    <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
      <View role="table" style={{ minWidth: width, flexGrow: 1 }}>
        <View role="row" className="flex-row border-b border-line bg-wash">
          {columns.map((c, i) => (
            <Text
              key={i}
              role="columnheader"
              numberOfLines={1}
              className="flex-1 px-3 py-1 text-xs font-semibold uppercase text-ink-muted"
            >
              {c}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <Pressable
            key={row.id}
            role="row"
            onPress={row.onPress}
            className="flex-row border-b border-line hover:bg-wash"
          >
            {row.cells.map((cell, i) => (
              <Text
                key={i}
                role="cell"
                numberOfLines={1}
                className={
                  i === 0
                    ? 'flex-1 px-3 py-2 text-sm text-ink'
                    : 'flex-1 px-3 py-2 text-sm text-ink-muted'
                }
              >
                {cell}
              </Text>
            ))}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
