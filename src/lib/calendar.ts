import { addDays, addMonths, weekdayOf, type IsoDate } from './parser/dates';
import { asRecurrence } from './recurrence';

// Calendário (C1): a grade do mês e o que cai em cada dia. As datas de uma tarefa recorrente são
// as mesmas que o feed .ics gera com RRULE (public._ics_rrule): semanal e mensal contam da data
// original (mensal num dia que o mês não tem cai no último dia), "dias da semana" conta a própria
// data e depois os dias marcados.

/** Mês no formato 'YYYY-MM'. */
export type Month = string;

export const monthOf = (date: IsoDate): Month => date.slice(0, 7);

export function shiftMonth(month: Month, delta: number): Month {
  return monthOf(addMonths(`${month}-01`, delta));
}

/** Semana que contém a data, começando no domingo (0) ou na segunda (1). */
export function weekOf(date: IsoDate, weekStart: 0 | 1): IsoDate[] {
  const first = addDays(date, -((weekdayOf(date) - weekStart + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Semanas inteiras que cobrem o mês (4 a 6 linhas de 7 dias). */
export function monthGrid(month: Month, weekStart: 0 | 1): IsoDate[][] {
  const weeks: IsoDate[][] = [];
  let week = weekOf(`${month}-01`, weekStart);
  while (week.some((d) => monthOf(d) === month)) {
    weeks.push(week);
    week = week.map((d) => addDays(d, 7));
  }
  return weeks;
}

/** Datas da tarefa entre `from` e `to` (inclusive). Sem recorrência, só o vencimento. */
export function occurrences(
  recurrence: unknown,
  due: IsoDate | null,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  if (!due || due > to) return [];
  const r = asRecurrence(recurrence);
  if (!r) return due >= from ? [due] : [];
  const out: IsoDate[] = [];
  const push = (d: IsoDate) => {
    if (d >= from && d <= to) out.push(d);
  };
  // Limite de segurança: o calendário nunca pede mais que algumas semanas
  const LIMIT = 400;
  switch (r.type) {
    case 'daily':
      for (let d = due > from ? due : from, i = 0; d <= to && i < LIMIT; d = addDays(d, 1), i++)
        out.push(d);
      break;
    case 'weekly':
      for (let d = due, i = 0; d <= to && i < LIMIT * 4; d = addDays(d, 7), i++) push(d);
      break;
    case 'monthly':
      for (let n = 0, d = due; d <= to && n < LIMIT; d = addMonths(due, ++n)) push(d);
      break;
    case 'weekdays': {
      push(due);
      let d = addDays(due > from ? due : addDays(from, -1), 1);
      for (let i = 0; d <= to && i < LIMIT * 4; d = addDays(d, 1), i++)
        if (r.days.includes(weekdayOf(d))) push(d);
      break;
    }
  }
  return out;
}

export type CalendarTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  /** 'HH:MM[:SS]' (D206); sem horário, null */
  due_time?: string | null;
  recurrence: unknown;
  page_id: string;
};

export type CalendarPage = { name: string; workout: boolean; habits: boolean };

export type CalendarEntry =
  | { kind: 'task'; id: string; title: string; done: boolean; pageId: string; time: string | null }
  /** Página de treino: um item só por dia, com quantos exercícios caem nele. */
  | { kind: 'workout'; id: string; title: string; count: number; pageId: string };

/**
 * O que cai em cada dia do intervalo. Hábitos ficam de fora (têm a tela deles); página de treino
 * (de cards ou da Academia) vira um item por dia. Concluída sem recorrência aparece riscada.
 * As tarefas vêm na ordem de exibição; os treinos vêm antes.
 */
export function calendarDays(
  tasks: readonly CalendarTask[],
  pages: Readonly<Record<string, CalendarPage>>,
  from: IsoDate,
  to: IsoDate,
): Record<IsoDate, CalendarEntry[]> {
  const days: Record<IsoDate, CalendarEntry[]> = {};
  const add = (date: IsoDate, entry: CalendarEntry) => (days[date] ??= []).push(entry);
  for (const task of tasks) {
    const page = pages[task.page_id];
    if (page?.habits) continue;
    for (const date of occurrences(task.recurrence, task.due_date, from, to)) {
      if (page?.workout) {
        const same = days[date]?.find((e) => e.kind === 'workout' && e.pageId === task.page_id);
        if (same?.kind === 'workout') same.count++;
        else
          add(date, {
            kind: 'workout',
            id: `${task.page_id}:${date}`,
            title: page.name,
            count: 1,
            pageId: task.page_id,
          });
      } else {
        add(date, {
          kind: 'task',
          id: task.id,
          title: task.title,
          done: task.status === 'done' && !asRecurrence(task.recurrence),
          pageId: task.page_id,
          time: task.due_time ? task.due_time.slice(0, 5) : null,
        });
      }
    }
  }
  for (const list of Object.values(days))
    // Treinos antes; depois as com horário, pela hora; as sem horário mantêm a ordem
    list.sort(
      (a, b) =>
        Number(b.kind === 'workout') - Number(a.kind === 'workout') ||
        (a.kind === 'task' && b.kind === 'task' && a.time && b.time
          ? a.time.localeCompare(b.time)
          : Number(!!(b.kind === 'task' && b.time)) - Number(!!(a.kind === 'task' && a.time))),
    );
  return days;
}
