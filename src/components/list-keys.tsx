import { useQueryClient } from '@tanstack/react-query';
import { uuidv7 } from '@/lib/uuid';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToggleWithUndo } from '@/components/tasks/task-row';
import { ActionMenu, useDialog } from '@/components/ui/dialog';
import { addDays } from '@/lib/parser/dates';
import type { Priority, Recurrence, TaskMeta } from '@/lib/parser/quick';
import { positionAfterMove } from '@/lib/positions';
import { useToday } from '@/lib/queries/profile';
import { keys } from '@/lib/queries/keys';
import { effectiveMaxDepth, MAX_CHILDREN_PER_TASK } from '@/config/limits';
import { useCreateTasks, useDeleteTask, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { rootFolder } from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';
import { planIndent, planOutdent, type MovePlan } from '@/lib/task-tree';
import { treeState } from '@/lib/tree-state';
import { useStartTask } from '@/lib/queries/dependencies';
import { selection } from '@/lib/selection';
import { focusCaptureField, toggleSidebar } from '@/lib/ui-state';
import { useShortcut } from '@/lib/use-shortcut';
import { undoLast, useToast } from '@/providers/toast';

const DELETE_DELAY_MS = 5000;

// Apagadas ainda dentro do prazo do "Desfazer": um refetch nesse meio tempo as traria de volta
const pendingDeletes = new Set<string>();
const withoutPending = (list: unknown) =>
  Array.isArray(list) && list.some((t: Task) => pendingDeletes.has(t.id))
    ? (list as Task[]).filter((t) => !pendingDeletes.has(t.id))
    : list;

export function ListKeys() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const today = useToday();
  const toast = useToast();
  const queryClient = useQueryClient();
  const toggle = useToggleWithUndo();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const create = useCreateTasks();
  const [dating, setDating, closeDating] = useDialog<Task>();
  const tree = useTree();
  const start = useStartTask();

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (pendingDeletes.size === 0 || event.type !== 'updated') return;
        const { queryKey, state } = event.query;
        if (queryKey[0] !== 'tasks') return;
        const filtered = withoutPending(state.data);
        if (filtered !== state.data) queryClient.setQueryData(queryKey, filtered);
      }),
    [queryClient],
  );

  // Ação sobre a tarefa selecionada; sem seleção, a tecla segue para a tela
  const onSelected = (action: (task: Task) => void | boolean) => () => {
    const task = selection.selectedTask();
    if (!task) return false;
    return action(task);
  };

  useShortcut('list.next', () => selection.move(1));
  useShortcut('list.prev', () => selection.move(-1));

  useShortcut('item.rename', () => {
    const task = selection.selectedTask();
    if (task) return selection.edit(task.id);
    const match = /^\/(page|folder)\/([^/]+)/.exec(pathname);
    if (!match) return false;
    selection.rename({ kind: match[1] as 'page' | 'folder', id: match[2] });
  });

  useShortcut(
    'item.open',
    onSelected((task) => router.push({ pathname: '/task/[id]', params: { id: task.id } })),
  );
  useShortcut(
    'task.edit',
    onSelected((task) => router.push({ pathname: '/task/[id]', params: { id: task.id } })),
  );
  useShortcut('task.advanced', () => {
    const page = /^\/page\/([^/]+)/.exec(pathname)?.[1];
    router.push({ pathname: '/task/new', params: page ? { page } : {} });
  });
  useShortcut(
    'task.assign',
    onSelected((task) => router.push({ pathname: '/task/[id]', params: { id: task.id } })),
  );

  useShortcut('list.deselect', () => {
    if (!selection.get().selectedId) return false;
    selection.select(null);
  });

  useShortcut(
    'task.toggle',
    onSelected((task) => toggle(task, task.status !== 'done')),
  );

  const priority = (level: 1 | 2 | 3) =>
    onSelected((task) =>
      // A mesma tecla de novo tira a prioridade
      update.mutate({ id: task.id, patch: { priority: task.priority === level ? 0 : level } }),
    );
  useShortcut('task.priority1', priority(1));
  useShortcut('task.priority2', priority(2));
  useShortcut('task.priority3', priority(3));

  useShortcut(
    'task.date',
    onSelected((task) => setDating(task)),
  );

  const moveBy = (delta: -1 | 1) =>
    onSelected((task) => {
      // Só faz sentido dentro de uma página: as irmãs abertas (mesma mãe), na ordem da tela
      const siblings = selection
        .get()
        .list.filter(
          (t) =>
            t.page_id === task.page_id &&
            t.status !== 'done' &&
            t.parent_task_id === task.parent_task_id,
        );
      const from = siblings.findIndex((t) => t.id === task.id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= siblings.length) return;
      const position = positionAfterMove(
        siblings.map((t) => t.position),
        from,
        to,
      );
      update.mutate({ id: task.id, patch: { position } });
    });
  useShortcut('task.moveUp', moveBy(-1));
  useShortcut('task.moveDown', moveBy(1));

  // Árvore (V3 §1.2): Tab / Shift+Tab mudam o nível, respeitando o limite da página
  const pageTasks = (task: Task) =>
    queryClient.getQueryData<Task[]>(keys.pageTasks(task.page_id)) ?? selection.get().list;
  const maxDepthFor = (task: Task) => {
    const page = tree.data?.pages.find((p) => p.id === task.page_id);
    return effectiveMaxDepth(page?.max_depth, rootFolder(tree.data, page?.folder_id)?.max_depth);
  };
  const applyPlan = (task: Task, plan: MovePlan, max: number) => {
    if (!plan.ok) {
      if (plan.reason === 'limit') toast({ message: t('tree.limit', { max }) });
      if (plan.reason === 'full') toast({ message: t('tree.full') });
      return;
    }
    if (plan.parentId) treeState.expand(plan.parentId);
    update.mutate(
      { id: task.id, patch: { parent_task_id: plan.parentId, position: plan.position } },
      { onError: (err) => toast({ message: err.message }) },
    );
  };
  useShortcut(
    'task.indent',
    onSelected((task) => {
      const max = maxDepthFor(task);
      applyPlan(task, planIndent(task, pageTasks(task), max, MAX_CHILDREN_PER_TASK), max);
    }),
  );
  useShortcut(
    'task.outdent',
    onSelected((task) => applyPlan(task, planOutdent(task, pageTasks(task)), maxDepthFor(task))),
  );
  // S: inicia ou para (o servidor recusa tarefa bloqueada no modo estrito, e o aviso diz por quê)
  useShortcut(
    'task.start',
    onSelected((task) => {
      if (task.status === 'done') return false;
      start.mutate(
        { id: task.id, started: task.status !== 'doing' },
        { onError: (err) => toast({ message: err.message }) },
      );
    }),
  );
  useShortcut(
    'task.link',
    onSelected((task) =>
      router.push({ pathname: '/task/[id]', params: { id: task.id, focus: 'deps' } }),
    ),
  );
  useShortcut('tree.codes', () => treeState.setCodes(!treeState.codes()));
  useShortcut(
    'tree.expand',
    onSelected((task) => {
      if (!pageTasks(task).some((t) => t.parent_task_id === task.id)) return false;
      treeState.expand(task.id);
    }),
  );
  useShortcut(
    'tree.collapse',
    onSelected((task) => {
      // Aberta: fecha; fechada (ou folha): vai para a mãe
      if (treeState.isExpanded(task.id)) return treeState.collapse(task.id);
      if (task.parent_task_id) selection.select(task.parent_task_id);
      else return false;
    }),
  );

  useShortcut(
    'task.delete',
    onSelected((task) => {
      selection.move(1);
      if (selection.get().selectedId === task.id) selection.select(null);
      pendingDeletes.add(task.id);
      queryClient.setQueriesData({ queryKey: keys.tasks }, withoutPending);
      const timer = setTimeout(
        () => remove.mutate(task.id, { onSettled: () => pendingDeletes.delete(task.id) }),
        DELETE_DELAY_MS,
      );
      toast({
        message: t('task.deleted', { title: task.title }),
        action: {
          label: t('common.undo'),
          onPress: () => {
            clearTimeout(timer);
            pendingDeletes.delete(task.id);
            queryClient.invalidateQueries({ queryKey: keys.tasks });
          },
        },
      });
    }),
  );

  useShortcut(
    'task.duplicate',
    onSelected((task) => {
      create.mutate({
        pageId: task.page_id,
        items: [
          {
            id: uuidv7(),
            title: task.title,
            priority: task.priority as Priority,
            dueDate: task.due_date,
            labels: task.labels,
            recurrence: task.recurrence as Recurrence | null,
            meta: task.meta as TaskMeta | null,
            mentions: [],
            prereqs: [],
          },
        ],
      });
      toast({ message: t('task.duplicated', { title: task.title }) });
    }),
  );

  useShortcut('capture.focus', () => {
    if (!focusCaptureField()) router.push('/capture');
  });
  useShortcut('app.undo', () => {
    // Dentro de um campo de texto, Ctrl+Z é do campo
    const el = typeof document !== 'undefined' ? document.activeElement : null;
    if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return false;
    return undoLast();
  });
  useShortcut('app.sidebar', () => toggleSidebar());
  useShortcut('help.open', () => router.navigate('/ajuda'));
  useShortcut('go.today', () => router.navigate('/today'));
  useShortcut('go.inbox', () => router.navigate('/inbox'));
  useShortcut('go.mine', () => router.navigate('/mine'));

  if (!dating) return null;
  const setDue = (due: string | null) => () =>
    update.mutate({ id: dating.id, patch: { due_date: due } });
  return (
    <ActionMenu
      title={t('task.dateTitle', { title: dating.title })}
      onClose={closeDating}
      actions={[
        { label: t('taskDetail.today'), onPress: setDue(today) },
        { label: t('taskDetail.tomorrow'), onPress: setDue(addDays(today, 1)) },
        { label: t('task.nextWeek'), onPress: setDue(addDays(today, 7)) },
        { label: t('taskDetail.noDate'), onPress: setDue(null) },
      ]}
    />
  );
}
