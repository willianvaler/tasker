import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BaseTable, type Row } from '@/components/base-view';
import { useFieldText, usePeople } from '@/components/fields';
import { GanttView } from '@/components/project/gantt-view';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { TaskRow } from '@/components/tasks/task-row';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cellInput, nextSort, parseCell, sortRows, type BaseSort } from '@/lib/base-config';
import { formatFieldValue, parseFieldInput } from '@/lib/fields';
import {
  applyView,
  fixedKeys,
  groupField,
  groupTasks,
  moveTo,
  type ListView,
  type ViewContext,
} from '@/lib/list-views';
import { formatDueDate } from '@/lib/parser/dates';
import { childrenMap, formatDuration } from '@/lib/task-tree';
import { rollup, sumDescendants } from '@/lib/totals';
import { fold } from '@/lib/query/parse';
import { usePageFields, type PageField } from '@/lib/queries/fields';
import { rootFolder, useAssigneeMutations, useAssignees } from '@/lib/queries/projects';
import { useUpdateTask, type Task, type TaskPatch } from '@/lib/queries/tasks';
import { useTree, type Page } from '@/lib/queries/tree';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { CalendarView } from './calendar-view';
import { COLUMN_LABEL } from './view-dialog';

type Counts = Map<string, { done: number; total: number }>;

/** O que a visão precisa saber além das tarefas: responsáveis, campos e nomes. */
function useViewContext(page: Page, today: string) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const assignees = useAssignees();
  const fields = usePageFields(page.id).data ?? [];
  const people = usePeople(page.folder_id);
  const byTask = new Map<string, string[]>();
  for (const a of assignees.data ?? [])
    if (a.user_id) byTask.set(a.task_id, [...(byTask.get(a.task_id) ?? []), a.user_id]);
  const ctx: ViewContext = {
    today,
    me: session?.user.id ?? null,
    assigneesOf: (id) => byTask.get(id) ?? [],
  };
  const fieldOf = (id: string | null) => fields.find((f) => f.id === id);
  const status: Record<string, string> = {
    todo: t('kanban.todo'),
    doing: t('kanban.doing'),
    done: t('kanban.done'),
  };
  /** Nome do grupo (coluna do quadro, faixa da lista e da tabela) */
  const groupLabel = (group: ListView['group'], key: string) => {
    if (group === 'status') return status[key] ?? key;
    if (group === 'priority') return key === '0' ? t('views.noPriority') : '!'.repeat(Number(key));
    if (group === 'assignee') return key ? (people.get(key) ?? '…') : t('views.nobody');
    if (group === 'label') return key ? `#${key}` : t('views.noLabel');
    const field = fieldOf(groupField(group));
    if (!key) return t('views.noValue', { name: field?.name ?? '' });
    return field?.kind === 'person' ? (people.get(key) ?? '…') : key;
  };
  const fixed = (group: ListView['group']) => {
    const field = fieldOf(groupField(group));
    return fixedKeys(group, {
      people: [...people.keys()],
      fieldOptions: field?.kind === 'person' ? [...people.keys()] : field?.options,
    });
  };
  return { ctx, fields, people, groupLabel, fixed, status, locale: i18n.language, byTask };
}

/** O corpo de uma visão salva (VS1): lista, quadro, tabela, calendário ou Gantt. */
export function SavedViewBody({
  view,
  page,
  tasks,
  today,
  subtaskCount,
  onChange,
}: {
  view: ListView;
  page: Page;
  tasks: Task[];
  today: string;
  subtaskCount: Counts;
  /** Quem pode mudar a visão grava o que mudou nela (o total do rodapé, VS2) */
  onChange?: (view: ListView) => void;
}) {
  const { t } = useTranslation();
  const tree = useTree();
  const vc = useViewContext(page, today);
  const shown = applyView(tasks, view, vc.ctx);

  if (view.kind === 'gantt') {
    const root = rootFolder(tree.data, page.folder_id);
    return root ? <GanttView root={root} only={shown.map((task) => task.id)} /> : null;
  }
  if (view.kind === 'calendar')
    return <CalendarView tasks={shown} today={today} subtaskCount={subtaskCount} />;
  if (view.kind === 'board')
    return <ViewBoard view={view} page={page} tasks={shown} vc={vc} subtaskCount={subtaskCount} />;
  if (view.kind === 'table')
    return (
      <ViewTable
        view={view}
        page={page}
        tasks={shown}
        all={tasks}
        vc={vc}
        today={today}
        onChange={onChange}
      />
    );

  if (!shown.length) return <EmptyState title={t('views.none')} />;
  const groups =
    view.group === 'none'
      ? [{ key: '', tasks: shown }]
      : groupTasks(shown, view.group, vc.ctx, vc.fixed(view.group), false);
  return (
    <View>
      {groups.map((g) => (
        <View key={g.key || '-'}>
          {view.group !== 'none' && (
            <SectionLabel title={vc.groupLabel(view.group, g.key)} count={g.tasks.length} />
          )}
          {g.tasks.map((task) => (
            <TaskRow key={task.id} task={task} today={today} subtasks={subtaskCount.get(task.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}

type ViewCtx = ReturnType<typeof useViewContext>;

/** Quadro por campo: arrastar (ou as setas) muda o valor do grupo na tarefa. */
function ViewBoard({
  view,
  page,
  tasks,
  vc,
  subtaskCount,
}: {
  view: ListView;
  page: Page;
  tasks: Task[];
  vc: ViewCtx;
  subtaskCount: Counts;
}) {
  const toast = useToast();
  const update = useUpdateTask();
  const assignees = useAssignees();
  const { add, remove } = useAssigneeMutations();
  // Por estado, o quadro de sempre (concluir pela RPC, com XP)
  if (view.group === 'status')
    return <KanbanBoard tasks={tasks} folderId={page.folder_id} subtaskCount={subtaskCount} />;
  const columns = groupTasks(tasks, view.group, vc.ctx, vc.fixed(view.group), true).map((g) => ({
    key: g.key,
    title: vc.groupLabel(view.group, g.key),
    tasks: g.tasks,
  }));
  const onError = (err: Error) => toast({ message: err.message });
  const onMove = (task: Task, from: string, to: string) => {
    const result = moveTo(task, view.group, from, to);
    if (!result) return;
    if (result.type === 'patch')
      update.mutate({ id: task.id, patch: result.patch as TaskPatch }, { onError });
    else if (result.type === 'assignee') {
      const row = (assignees.data ?? []).find(
        (a) => a.task_id === task.id && a.user_id === result.remove,
      );
      if (row) remove.mutate(row.id, { onError });
      if (result.add && !vc.ctx.assigneesOf(task.id).includes(result.add))
        add.mutate({ taskId: task.id, userId: result.add }, { onError });
    }
  };
  return (
    <KanbanBoard
      tasks={tasks}
      folderId={page.folder_id}
      subtaskCount={subtaskCount}
      columns={columns}
      onMove={onMove}
    />
  );
}

const DEFAULT_COLUMNS = ['title', 'due', 'priority', 'tags', 'status'];
const FIXED_EDITABLE = ['title', 'due', 'start', 'priority', 'tags'];

/** Tabela: a das Bases (OB8), com as tarefas desta lista e os campos dela; edita na célula. */
function ViewTable({
  view,
  page,
  tasks,
  all,
  vc,
  today,
  onChange,
}: {
  view: ListView;
  page: Page;
  tasks: Task[];
  /** Todas as tarefas da lista: o total das subtarefas na mãe (VS2) */
  all: Task[];
  vc: ViewCtx;
  today: string;
  onChange?: (view: ListView) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateTask();
  const fieldText = useFieldText(page.id, page.folder_id);
  const [sort, setSort] = useState<BaseSort | null>(null);
  const kids = childrenMap(all);
  const byId = new Map(all.map((task) => [task.id, task]));
  const fieldOf = (column: string): PageField | undefined =>
    column.startsWith('field:') ? vc.fields.find((f) => f.id === column.slice(6)) : undefined;
  // Coluna de um campo que foi apagado some
  const columns = (view.columns.length ? view.columns : DEFAULT_COLUMNS).filter(
    (c) => !c.startsWith('field:') || fieldOf(c),
  );

  // Valor da própria tarefa; nos números, a mãe sem valor mostra o total das filhas (rollup)
  const own = (task: Task, column: string): unknown => {
    const field = fieldOf(column);
    if (field) return fieldText.value(field, task);
    if (column === 'estimate') return task.estimate_minutes;
    if (column === 'time') return task.actual_minutes || null;
    return base(task, column);
  };
  const numeric = (column: string) => {
    const field = fieldOf(column);
    return field
      ? field.kind === 'number' || field.kind === 'money' || field.kind === 'formula'
      : column === 'estimate';
  };
  const rolled = (task: Task, column: string): number | null => {
    if (!kids.has(task.id)) return null;
    if (column === 'time')
      return sumDescendants(task.id, kids, (id) => byId.get(id)?.actual_minutes ?? 0) || null;
    if (!numeric(column)) return null;
    return rollup(task.id, kids, (id) => {
      const child = byId.get(id);
      const v = child ? own(child, column) : null;
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    });
  };
  const value = (task: Task, column: string): unknown => {
    const v = own(task, column);
    if (column === 'time') {
      const sub = rolled(task, column);
      return sub === null ? v : ((v as number | null) ?? 0) + sub;
    }
    return v === null || v === undefined || v === '' ? (rolled(task, column) ?? v) : v;
  };
  const base = (task: Task, column: string): unknown => {
    switch (column) {
      case 'title':
        return task.title;
      case 'due':
        return task.due_date;
      case 'start':
        return task.start_date;
      case 'priority':
        return task.priority;
      case 'tags':
        return task.labels ?? [];
      case 'status':
        return task.status;
      case 'assignees':
        return vc.ctx.assigneesOf(task.id).map((id) => vc.people.get(id) ?? '…');
      default:
        return null;
    }
  };
  const show = (task: Task, column: string): string => {
    const v = value(task, column);
    const field = fieldOf(column);
    // Σ marca o total que veio das subtarefas
    const sigma =
      numeric(column) && v !== null && v !== undefined && v !== own(task, column) ? 'Σ ' : '';
    if (field) return sigma + fieldText.text(field, task, v);
    if (v === null || v === undefined || v === '') return '';
    if (column === 'estimate' || column === 'time') return sigma + formatDuration(Number(v));
    if (column === 'due' || column === 'start') return formatDueDate(String(v), today);
    if (column === 'priority') return v ? '!'.repeat(Number(v)) : '';
    if (column === 'tags') return (v as string[]).map((l) => `#${l}`).join(' ');
    if (column === 'status') return vc.status[String(v)] ?? String(v);
    if (column === 'assignees') return (v as string[]).join(', ');
    return String(v);
  };
  const rows: Row[] = tasks.map((task) => ({
    id: task.id,
    kind: 'task',
    task,
    value: (c) => value(task, c),
    show: (c) => show(task, c),
  }));
  const sorted = sort ? sortRows(rows, (r) => r.value(sort.column), sort.desc) : rows;
  const groups =
    view.group === 'none'
      ? null
      : groupTasks(
          sorted.map((r) => r.task as Task),
          view.group,
          vc.ctx,
          vc.fixed(view.group),
          false,
        ).map((g) => ({
          key: vc.groupLabel(view.group, g.key),
          rows: g.tasks.map((task) => sorted.find((r) => r.id === task.id) as Row),
        }));

  const label = (column: string) =>
    fieldOf(column)?.name ??
    (column in COLUMN_LABEL ? t(COLUMN_LABEL[column as keyof typeof COLUMN_LABEL]) : column);

  const parse = (column: string, text: string, current: unknown) => {
    const field = fieldOf(column);
    if (!field) return parseCell(column === 'start' ? 'due' : column, text, current);
    if (field.kind === 'select') {
      const s = text.trim();
      if (!s) return { ok: true as const, value: null };
      const option = field.options.find((o) => fold(o) === fold(s));
      return option ? { ok: true as const, value: option } : { ok: false as const };
    }
    if (field.kind === 'person') {
      const s = text.trim();
      if (!s) return { ok: true as const, value: null };
      const found = [...vc.people].find(([, name]) => fold(name) === fold(s));
      return found ? { ok: true as const, value: found[0] } : { ok: false as const };
    }
    const v = parseFieldInput(field.kind, text);
    return v === undefined ? { ok: false as const } : { ok: true as const, value: v };
  };
  const input = (column: string, raw: unknown) => {
    const field = fieldOf(column);
    if (field?.kind === 'person') return raw ? (vc.people.get(String(raw)) ?? '') : '';
    if (field) return raw == null ? '' : String(raw);
    return cellInput(column === 'start' ? 'due' : column, raw);
  };
  const save = (row: Row, column: string, next: unknown) => {
    const task = row.task;
    if (!task) return;
    const onError = (err: Error) => toast({ message: err.message });
    const field = fieldOf(column);
    if (field) {
      const custom = {
        ...(task.custom && typeof task.custom === 'object' && !Array.isArray(task.custom)
          ? task.custom
          : {}),
      } as Record<string, unknown>;
      if (next === null) delete custom[field.id];
      else custom[field.id] = next;
      update.mutate({ id: task.id, patch: { custom } as TaskPatch }, { onError });
      return;
    }
    const key = (
      {
        title: 'title',
        due: 'due_date',
        start: 'start_date',
        priority: 'priority',
        tags: 'labels',
      } as const
    )[column as 'title'];
    if (key) update.mutate({ id: task.id, patch: { [key]: next } as TaskPatch }, { onError });
  };

  if (!rows.length) return <EmptyState title={t('views.none')} />;
  return (
    <View className="gap-2">
      <Text className="text-xs text-ink-muted">
        {t('query.countTasks', { count: rows.length })}
      </Text>
      <BaseTable
        source="tasks"
        columns={columns}
        groups={groups}
        emptyGroup=""
        rows={sorted}
        sort={sort}
        onHeader={(c) => setSort(nextSort(sort, c))}
        onSave={save}
        options={{
          label,
          editable: (c) =>
            FIXED_EDITABLE.includes(c) || (!!fieldOf(c) && fieldOf(c)?.kind !== 'formula'),
          parse,
          input,
          totals: view.totals,
          onTotal: onChange
            ? (c, total) => onChange({ ...view, totals: { ...view.totals, [c]: total } })
            : undefined,
          formatTotal: (c, n) => {
            const field = fieldOf(c);
            if (field?.kind === 'money') return formatFieldValue('money', n, vc.locale);
            if (c === 'estimate' || c === 'time') return formatDuration(n);
            return new Intl.NumberFormat(vc.locale, { maximumFractionDigits: 2 }).format(n);
          },
          formatValue: (c, v) => {
            const field = fieldOf(c);
            if (field?.kind === 'person') return vc.people.get(v) ?? v;
            if (c === 'status') return vc.status[v] ?? v;
            if (c === 'tags') return `#${v}`;
            return v;
          },
        }}
      />
    </View>
  );
}
