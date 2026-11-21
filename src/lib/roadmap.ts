import { tr } from './i18n-ref';
import type { IsoDate } from './parser/dates';

// Roadmap por marco (GP3, D315): os marcos do projeto em ordem de data, cada um com as tarefas
// ligadas, o progresso, o que atrasou e o que está bloqueado. Funções puras, com teste.

export type RoadmapMilestone = {
  id: string;
  name: string;
  due_date: string | null;
  done_at: string | null;
};
export type RoadmapTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
};

export type RoadmapEntry = {
  milestone: RoadmapMilestone;
  tasks: RoadmapTask[];
  done: number;
  total: number;
  /** Abertas com vencimento já passado */
  late: number;
  /** Abertas esperando um pré-requisito */
  blocked: number;
  /** A data do marco passou e ainda há tarefa aberta (destaque) */
  overdue: boolean;
};

/** Marcos em ordem de data (sem data por último) com as tarefas de cima ligadas a cada um. */
export function buildRoadmap(
  milestones: readonly RoadmapMilestone[],
  tasks: readonly RoadmapTask[],
  today: IsoDate,
  isBlocked: (taskId: string) => boolean,
): { entries: RoadmapEntry[]; unlinked: number } {
  const top = tasks.filter((t) => !t.parent_task_id);
  const entries = [...milestones]
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .map((milestone) => {
      const list = top.filter((t) => t.milestone_id === milestone.id);
      const open = list.filter((t) => t.status !== 'done');
      return {
        milestone,
        tasks: [...open, ...list.filter((t) => t.status === 'done')],
        done: list.length - open.length,
        total: list.length,
        late: open.filter((t) => t.due_date && t.due_date < today).length,
        blocked: open.filter((t) => isBlocked(t.id)).length,
        overdue:
          !!milestone.due_date &&
          milestone.due_date < today &&
          !milestone.done_at &&
          open.length > 0,
      };
    });
  const known = new Set(milestones.map((m) => m.id));
  const unlinked = top.filter(
    (t) => t.status !== 'done' && (!t.milestone_id || !known.has(t.milestone_id)),
  ).length;
  return { entries, unlinked };
}

/** "Notas da versão" de um marco: o que foi feito, em Markdown (vira anotação ou se copia). */
export function releaseNotes(entry: Pick<RoadmapEntry, 'milestone' | 'tasks'>, date: IsoDate) {
  const done = entry.tasks.filter((t) => t.status === 'done');
  const open = entry.tasks.filter((t) => t.status !== 'done');
  const lines = [tr('roadmap.notesIntro', { name: entry.milestone.name, date }), ''];
  if (done.length) {
    lines.push(`## ${tr('roadmap.notesDone')}`, '', ...done.map((t) => `- ${t.title}`), '');
  }
  if (open.length) {
    lines.push(`## ${tr('roadmap.notesOpen')}`, '', ...open.map((t) => `- ${t.title}`), '');
  }
  return lines.join('\n').trimEnd() + '\n';
}
