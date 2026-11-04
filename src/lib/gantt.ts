// Gantt editável (PC3, V3 §6 C, D308): barras do início (`start_date`) ao vencimento (`due_date`)
// das tarefas do projeto, na ordem das listas, com as dependências. Funções puras, com teste; a
// tela (components/project/gantt-view) só desenha e chama `dragDates` ao arrastar.
//
// Regras, as mesmas do trigger tasks_start_date_fit: sem vencimento não há barra (a tarefa fica em
// "Sem data"); sem início, a barra é o dia do vencimento; o início nunca passa do vencimento.

import { addDays, type IsoDate } from './parser/dates';

export type GanttTask = {
  id: string;
  title: string;
  page_id: string;
  parent_task_id: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  position: number;
};
export type GanttDep = { task_id: string; depends_on_task_id: string };

export type GanttRow = {
  task: GanttTask;
  /** 0 = tarefa da lista, 1 = subtarefa... */
  depth: number;
  start: IsoDate;
  end: IsoDate;
  /** Começa antes de um pré-requisito terminar (aviso, não bloqueia) */
  early: boolean;
};

export type GanttPlan = {
  rows: GanttRow[];
  /** Sem vencimento: ficam numa lista embaixo, para dar uma data */
  undated: GanttTask[];
  from: IsoDate;
  to: IsoDate;
  days: number;
};

/** No máximo um ano na tela: o que passar fica cortado na borda */
export const GANTT_MAX_DAYS = 366;

const MS_DAY = 86_400_000;
export const diffDays = (a: IsoDate, b: IsoDate) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_DAY);

/** Começo e fim da barra; sem vencimento, nenhuma */
export function barOf(task: Pick<GanttTask, 'start_date' | 'due_date'>) {
  if (!task.due_date) return null;
  const start =
    task.start_date && task.start_date < task.due_date ? task.start_date : task.due_date;
  return { start, end: task.due_date };
}

export type DragMode = 'move' | 'start' | 'end';

/**
 * Datas novas depois de arrastar `delta` dias: mover leva as duas; puxar o começo ou o fim muda só
 * aquela ponta, sem passar da outra. Sem início, puxar o começo cria o início.
 */
export function dragDates(
  task: Pick<GanttTask, 'start_date' | 'due_date'>,
  mode: DragMode,
  delta: number,
): { start_date: string | null; due_date: string } | null {
  const bar = barOf(task);
  if (!bar || !delta) return null;
  if (mode === 'move')
    return {
      start_date: task.start_date ? addDays(bar.start, delta) : null,
      due_date: addDays(bar.end, delta),
    };
  if (mode === 'start') {
    const start = addDays(bar.start, delta);
    return { start_date: start > bar.end ? bar.end : start, due_date: bar.end };
  }
  // Puxar o fim para antes do começo para no começo (barra de um dia)
  const end = addDays(bar.end, delta);
  // Sem início, esticar fixa o começo onde a barra estava; encolher um dia só leva o dia
  if (!task.start_date) return { start_date: delta > 0 ? bar.start : null, due_date: end };
  return { start_date: bar.start, due_date: end < bar.start ? bar.start : end };
}

/**
 * Linhas na ordem das listas (a ordem de `pageOrder`) e das tarefas, cada subtarefa logo abaixo da
 * mãe. Concluídas entram (o Gantt é o plano), e o intervalo da tela vai de 2 dias antes do
 * primeiro começo (ou de hoje) a 5 depois do último fim.
 */
export function ganttPlan(
  tasks: readonly GanttTask[],
  deps: readonly GanttDep[],
  {
    today,
    pageOrder,
    minDays = 0,
  }: {
    today: IsoDate;
    pageOrder: readonly string[];
    /** Dias que cabem na tela: o fim estica até preencher a largura */
    minDays?: number;
  },
): GanttPlan {
  const children = new Map<string | null, GanttTask[]>();
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    // Mãe que não está na lista (outra pasta): a subtarefa sobe para o primeiro nível
    const parent = t.parent_task_id && ids.has(t.parent_task_id) ? t.parent_task_id : null;
    children.set(parent, [...(children.get(parent) ?? []), t]);
  }
  const pageRank = new Map(pageOrder.map((id, i) => [id, i]));
  const order = (a: GanttTask, b: GanttTask) =>
    (pageRank.get(a.page_id) ?? 1e6) - (pageRank.get(b.page_id) ?? 1e6) ||
    a.position - b.position ||
    a.title.localeCompare(b.title);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const prereqs = new Map<string, string[]>();
  for (const d of deps)
    prereqs.set(d.task_id, [...(prereqs.get(d.task_id) ?? []), d.depends_on_task_id]);

  const rows: GanttRow[] = [];
  const undated: GanttTask[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const t of [...(children.get(parent) ?? [])].sort(order)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const bar = barOf(t);
      if (bar) {
        const early = (prereqs.get(t.id) ?? []).some((id) => {
          const pre = byId.get(id);
          const end = pre && barOf(pre)?.end;
          return !!end && pre.status !== 'done' && bar.start <= end;
        });
        rows.push({ task: t, depth, ...bar, early });
      } else if (t.status !== 'done') undated.push(t);
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);

  const starts = rows.map((r) => r.start);
  const ends = rows.map((r) => r.end);
  let from = addDays([today, ...starts].sort()[0], -2);
  let to = addDays([today, ...ends].sort().at(-1) ?? today, 5);
  if (diffDays(from, to) + 1 < minDays) to = addDays(from, Math.min(minDays, GANTT_MAX_DAYS) - 1);
  if (diffDays(from, to) + 1 > GANTT_MAX_DAYS) {
    // Muito longo: centra no que vem pela frente (a partir de uma semana antes de hoje)
    from = addDays(today, -7) > from ? addDays(today, -7) : from;
    to = addDays(from, GANTT_MAX_DAYS - 1);
  }
  return { rows, undated, from, to, days: diffDays(from, to) + 1 };
}

/** Setas das dependências entre linhas que estão na tela: do fim do pré-requisito ao começo da outra */
export function ganttArrows(rows: readonly GanttRow[], deps: readonly GanttDep[]) {
  const index = new Map(rows.map((r, i) => [r.task.id, i]));
  return deps.flatMap((d) => {
    const from = index.get(d.depends_on_task_id);
    const to = index.get(d.task_id);
    return from === undefined || to === undefined
      ? []
      : [{ from, to, id: `${d.depends_on_task_id}>${d.task_id}` }];
  });
}
