// Importar do Habitica e do Todoist (PC1, V3 §6 C, D306). Funções puras: leem o arquivo que cada
// app exporta e devolvem projetos no formato do `create_from_template` (o mesmo dos kits), para a
// pessoa conferir antes de criar. Nada é marcado como feito na importação (feito daria XP).
//
// Habitica: o JSON de "Exportar dados" (`tasks.habits/dailys/todos/rewards` e `tags`), ou só a lista
// de tarefas (cada uma com `type`). Hábitos viram hábitos bom/ruim; diárias, hábitos com os dias da
// semana; afazeres, tarefas com a checklist como subtarefas. Recompensas e concluídas ficam de fora.
//
// Todoist: o CSV de um projeto (TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, DATE...) ou o .zip do
// backup (um CSV por projeto). Cada projeto vira uma pasta e cada seção, uma lista; INDENT é a
// subtarefa, PRIORITY 1 (a mais alta) a 4 vira !!! a nada, @etiqueta vira #etiqueta e o comentário
// (TYPE note) vai para a descrição da tarefa de cima.

import type { Recurrence } from './parser/quick';
import { makeDate, nextDayMonth } from './parser/dates';
import { parseQuickInput } from './parser/quick';

export type ImportItem = {
  id: string;
  title: string;
  notes?: string;
  priority: number;
  labels: string[];
  due_date?: string;
  recurrence?: Recurrence;
  habit_kind?: 'check' | 'plusminus';
  habit_sides?: 'both' | 'up' | 'down';
  children: ImportItem[];
};

export type ImportPage = {
  name: string;
  icon: string | null;
  view_type: 'list' | 'habits';
  reset_cycle: 'none' | 'daily';
  items: ImportItem[];
};

export type ImportProject = { name: string; icon: string; pages: ImportPage[] };

export type ImportPlan = {
  source: 'habitica' | 'todoist';
  projects: ImportProject[];
  /** Quantas tarefas (subtarefas inclusive) vão ser criadas */
  tasks: number;
  /** Ficaram de fora: concluídas, recompensas, linhas sem título, o que passou dos limites */
  skipped: { done: number; rewards: number; overLimit: number };
  /** Datas que o Todoist escreveu de um jeito que o app não entendeu (foram para a descrição) */
  unreadDates: number;
};

export type ImportNames = {
  /** Nome da pasta do Habitica */
  habitica: string;
  habits: string;
  dailies: string;
  todos: string;
  /** Tarefas do Todoist fora de seção, quando o projeto também tem seções */
  noSection: string;
  /** Prefixo da descrição com a data que não foi entendida: "Data no Todoist" */
  dateNote: string;
};

export type ImportOptions = { today: string; newId: () => string; names: ImportNames };

/** Limites do banco: 500 tarefas por lista (create_tasks_batch), 30 listas por projeto, 5 níveis */
export const PAGE_TASKS_MAX = 500;
export const PROJECT_PAGES_MAX = 30;
const DEPTH_MAX = 5;
const CHILDREN_MAX = 50;
const TITLE_MAX = 500;
const NOTES_MAX = 10000;
const LABELS_MAX = 20;

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
const title = (s: unknown) =>
  clip(
    String(s ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
    TITLE_MAX,
  );

/** "Trabalho 💼" → "trabalho": a etiqueta do app aceita letra, número, _ e - */
export function labelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

const uniqueLabels = (names: string[]) =>
  [...new Set(names.map(labelName).filter(Boolean))].slice(0, LABELS_MAX);

function countTasks(items: ImportItem[]): number {
  return items.reduce((n, item) => n + 1 + countTasks(item.children), 0);
}

/**
 * Divide uma lista grande em várias ("Afazeres", "Afazeres (2)"...) para caber no lote, e o
 * projeto em até 30 listas. Devolve quantas tarefas ficaram de fora.
 */
function fitPages(pages: ImportPage[]): { pages: ImportPage[]; overLimit: number } {
  const out: ImportPage[] = [];
  for (const page of pages) {
    let chunk: ImportItem[] = [];
    let size = 0;
    let part = 1;
    const flush = () => {
      if (!chunk.length) return;
      out.push({ ...page, name: part === 1 ? page.name : `${page.name} (${part})`, items: chunk });
      part++;
      chunk = [];
      size = 0;
    };
    for (const item of page.items) {
      const n = countTasks([item]);
      if (size + n > PAGE_TASKS_MAX) flush();
      chunk.push(item);
      size += n;
    }
    flush();
  }
  const kept = out.slice(0, PROJECT_PAGES_MAX);
  const overLimit = out.slice(PROJECT_PAGES_MAX).reduce((n, p) => n + countTasks(p.items), 0);
  return { pages: kept, overLimit };
}

function finish(
  source: ImportPlan['source'],
  raw: ImportProject[],
  skipped: Omit<ImportPlan['skipped'], 'overLimit'>,
  unreadDates: number,
): ImportPlan {
  let overLimit = 0;
  const projects: ImportProject[] = [];
  for (const project of raw) {
    const fitted = fitPages(project.pages.filter((p) => p.items.length));
    overLimit += fitted.overLimit;
    if (fitted.pages.length) projects.push({ ...project, pages: fitted.pages });
  }
  const tasks = projects.reduce(
    (n, p) => n + p.pages.reduce((m, page) => m + countTasks(page.items), 0),
    0,
  );
  return { source, projects, tasks, skipped: { ...skipped, overLimit }, unreadDates };
}

// ---------- Habitica ----------

type HabiticaTask = {
  type?: string;
  text?: string;
  notes?: string;
  up?: boolean;
  down?: boolean;
  priority?: number;
  frequency?: string;
  everyX?: number;
  repeat?: Record<string, boolean>;
  checklist?: { text?: string; completed?: boolean }[];
  completed?: boolean;
  date?: string | null;
  tags?: string[];
};

const HABITICA_DAYS: [string, number][] = [
  ['su', 0],
  ['m', 1],
  ['t', 2],
  ['w', 3],
  ['th', 4],
  ['f', 5],
  ['s', 6],
];

/** O arquivo é do Habitica? (o JSON de exportar ou só a lista de tarefas) */
export function isHabiticaExport(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const tasks = (data as { tasks?: unknown }).tasks;
  if (tasks && typeof tasks === 'object' && !Array.isArray(tasks))
    return ['habits', 'dailys', 'todos'].some((k) => Array.isArray((tasks as never)[k]));
  const list = Array.isArray(data) ? data : Array.isArray(tasks) ? tasks : null;
  return !!list?.some(
    (t) =>
      t &&
      typeof t === 'object' &&
      ['habit', 'daily', 'todo'].includes((t as HabiticaTask).type ?? ''),
  );
}

/** Dificuldade do Habitica (0,1 trivial; 1 fácil; 1,5 médio; 2 difícil) → prioridade do app */
function habiticaPriority(p: number | undefined): number {
  if (p === undefined || p < 1.5) return 0;
  return p >= 2 ? 2 : 1;
}

/** Diária do Habitica → recorrência do app. Intervalo maior que 1 ("a cada 3 dias") vira o mais próximo. */
export function habiticaRecurrence(task: HabiticaTask): Recurrence {
  if (task.frequency === 'monthly' || task.frequency === 'yearly') return { type: 'monthly' };
  // Os dias da semana (`repeat`) só valem na semanal; a diária usa o intervalo
  if (task.frequency === 'weekly') {
    const repeat = task.repeat ?? {};
    const days = HABITICA_DAYS.filter(([k]) => repeat[k] !== false).map(([, d]) => d);
    if (days.length === 0) return { type: 'weekly' };
    if (days.length < 7) return { type: 'weekdays', days };
  }
  return { type: 'daily' };
}

export function importHabitica(data: unknown, options: ImportOptions): ImportPlan {
  const { newId, names } = options;
  const root = (data ?? {}) as { tasks?: unknown; tags?: { id?: string; name?: string }[] };
  const tagName = new Map((root.tags ?? []).map((t) => [t.id ?? '', t.name ?? '']));
  let list: HabiticaTask[];
  if (root.tasks && typeof root.tasks === 'object' && !Array.isArray(root.tasks)) {
    const g = root.tasks as Record<string, HabiticaTask[] | undefined>;
    const typed = (key: string, type: string) => (g[key] ?? []).map((t) => ({ type, ...t }));
    list = [
      ...typed('habits', 'habit'),
      ...typed('dailys', 'daily'),
      ...typed('todos', 'todo'),
      ...typed('rewards', 'reward'),
    ];
  } else {
    list = (
      Array.isArray(data) ? data : Array.isArray(root.tasks) ? root.tasks : []
    ) as HabiticaTask[];
  }

  let done = 0;
  let rewards = 0;
  const pages: Record<'habit' | 'daily' | 'todo', ImportItem[]> = {
    habit: [],
    daily: [],
    todo: [],
  };
  for (const task of list) {
    if (!task || typeof task !== 'object') continue;
    if (task.type === 'reward') {
      rewards++;
      continue;
    }
    const type =
      task.type === 'habit' || task.type === 'daily' || task.type === 'todo' ? task.type : null;
    const text = title(task.text);
    if (!type || !text) continue;
    if (type === 'todo' && task.completed) {
      done++;
      continue;
    }
    const base: ImportItem = {
      id: newId(),
      title: text,
      priority: habiticaPriority(task.priority),
      labels: uniqueLabels((task.tags ?? []).map((id) => tagName.get(id) ?? '')),
      children: [],
    };
    const notes = String(task.notes ?? '').trim();
    const checklist = (task.checklist ?? []).filter((c) => title(c?.text));
    if (type === 'habit') {
      base.habit_kind = 'plusminus';
      base.habit_sides =
        task.up === false && task.down ? 'down' : task.down === false && task.up ? 'up' : 'both';
    } else if (type === 'daily') {
      base.habit_kind = 'check';
      base.recurrence = habiticaRecurrence(task);
    } else {
      const due = /^(\d{4}-\d{2}-\d{2})/.exec(task.date ?? '');
      if (due) base.due_date = due[1];
      for (const c of checklist) {
        if (c.completed) {
          done++;
          continue;
        }
        if (base.children.length < CHILDREN_MAX)
          base.children.push({
            id: newId(),
            title: title(c.text),
            priority: 0,
            labels: [],
            children: [],
          });
      }
    }
    // Na diária e no hábito a lista de checagem vai para a descrição (hábito não tem subtarefa)
    const extra =
      type === 'todo'
        ? []
        : checklist.map((c) => `${c.completed ? '[x]' : '[ ]'} ${title(c.text)}`);
    const body = [notes, extra.join('\n')].filter(Boolean).join('\n\n');
    if (body) base.notes = clip(body, NOTES_MAX);
    pages[type].push(base);
  }

  const project: ImportProject = {
    name: names.habitica,
    icon: '⚔️',
    pages: [
      {
        name: names.habits,
        icon: '➕',
        view_type: 'habits',
        reset_cycle: 'daily',
        items: pages.habit,
      },
      {
        name: names.dailies,
        icon: '📅',
        view_type: 'habits',
        reset_cycle: 'daily',
        items: pages.daily,
      },
      { name: names.todos, icon: '✅', view_type: 'list', reset_cycle: 'none', items: pages.todo },
    ],
  };
  return finish('habitica', [project], { done, rewards }, 0);
}

// ---------- Todoist ----------

/** CSV com aspas (RFC 4180), vírgula ou ponto e vírgula; tira o BOM */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** O CSV é do Todoist? (cabeçalho com TYPE e CONTENT) */
export function isTodoistCsv(text: string): boolean {
  const header = parseCsv(text.slice(0, 2000))[0]?.map((h) => h.trim().toUpperCase()) ?? [];
  return header.includes('TYPE') && header.includes('CONTENT');
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const WEEKDAY_WORDS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  domingo: 0,
  dom: 0,
  monday: 1,
  mon: 1,
  segunda: 1,
  'segunda-feira': 1,
  seg: 1,
  lunes: 1,
  lun: 1,
  tuesday: 2,
  tue: 2,
  terca: 2,
  'terca-feira': 2,
  ter: 2,
  martes: 2,
  mar: 2,
  wednesday: 3,
  wed: 3,
  quarta: 3,
  'quarta-feira': 3,
  qua: 3,
  miercoles: 3,
  mie: 3,
  thursday: 4,
  thu: 4,
  quinta: 4,
  'quinta-feira': 4,
  qui: 4,
  jueves: 4,
  jue: 4,
  friday: 5,
  fri: 5,
  sexta: 5,
  'sexta-feira': 5,
  sex: 5,
  viernes: 5,
  vie: 5,
  saturday: 6,
  sat: 6,
  sabado: 6,
  sab: 6,
};

/** "every day", "toda segunda", "cada semana"... → recorrência; o que não for repetição, null */
export function todoistRecurrence(date: string): Recurrence | null {
  const s = fold(date)
    .replace(/\b(at|as|a las|às)\b.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /^(every|todos? os|todas? as|todo|toda|cada|todos los|todas las)\s+(.*)$/.exec(s);
  if (!m) return null;
  const rest = m[2].trim();
  if (/^(day|dia|dias|days)$/.test(rest)) return { type: 'daily' };
  if (/^(week|semana|semanas|weeks)$/.test(rest)) return { type: 'weekly' };
  if (/^(month|mes|meses|months)$/.test(rest)) return { type: 'monthly' };
  if (/^(weekday|workday|dia util|dias uteis|dia habil|dias habiles|dia laborable)$/.test(rest))
    return { type: 'weekdays', days: [1, 2, 3, 4, 5] };
  const words = rest.split(/\s*(?:,|\be\b|\band\b|\by\b)\s*|\s+/).filter(Boolean);
  const days = words.map((w) => WEEKDAY_WORDS[w.replace(/s$/, '')] ?? WEEKDAY_WORDS[w]);
  if (words.length && days.every((d) => d !== undefined))
    return { type: 'weekdays', days: [...new Set(days as number[])].sort((a, b) => a - b) };
  return null;
}

// Começo do nome do mês nos três idiomas ("set" é setembro em pt; "sep" em en)
const MONTHS: string[][] = [
  ['jan', 'ene'],
  ['fev', 'feb'],
  ['mar'],
  ['abr', 'apr'],
  ['mai', 'may'],
  ['jun'],
  ['jul'],
  ['ago', 'aug'],
  ['set', 'sep'],
  ['out', 'oct'],
  ['nov'],
  ['dez', 'dec', 'dic'],
];

/** Data do Todoist ("2026-11-10", "Nov 10", "amanhã") → vencimento; sem entender, null */
export function todoistDate(date: string, today: string, lang: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // "Nov 10", "10 nov", "10 de novembro de 2026", "November 10, 2026"
  const s = fold(date)
    .replace(/[.,]/g, ' ')
    .replace(/\b(de|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const named =
    /^([a-z]+) (\d{1,2})(?: (\d{4}))?$/.exec(s) ?? /^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/.exec(s);
  if (named) {
    const [word, day] = /^\d/.test(named[1]) ? [named[2], named[1]] : [named[1], named[2]];
    const month = MONTHS.findIndex((m) => m.some((name) => word.startsWith(name))) + 1;
    if (month > 0) {
      const d = Number(day);
      return named[3] ? makeDate(Number(named[3]), month, d) : nextDayMonth(today, d, month);
    }
  }
  const parsed = parseQuickInput(`x ${date}`, {
    today,
    dateOrder: fold(lang).startsWith('en') ? 'mdy' : 'dmy',
  });
  return parsed.title === 'x' ? parsed.dueDate : null;
}

/** "Trabalho [2203306141].csv" → "Trabalho" */
export function todoistProjectName(fileName: string): string {
  const base = fileName.split('/').pop() ?? fileName;
  return (
    base
      .replace(/\.csv$/i, '')
      .replace(/\s*\[\d+\]\s*$/, '')
      .trim() || 'Todoist'
  );
}

export function importTodoist(
  files: { name: string; text: string }[],
  options: ImportOptions,
): ImportPlan {
  const { today, newId, names } = options;
  let done = 0;
  let unreadDates = 0;
  const projects: ImportProject[] = [];
  for (const file of files) {
    const rows = parseCsv(file.text);
    const header = rows.shift()?.map((h) => h.trim().toUpperCase()) ?? [];
    const col = (row: string[], name: string) => (row[header.indexOf(name)] ?? '').trim();
    if (!header.includes('TYPE') || !header.includes('CONTENT')) continue;

    const pages: ImportPage[] = [
      { name: names.noSection, icon: null, view_type: 'list', reset_cycle: 'none', items: [] },
    ];
    // Pilha dos níveis da seção atual: stack[i] é o último item no nível i+1
    let stack: ImportItem[] = [];
    let last: ImportItem | null = null;
    for (const row of rows) {
      const type = col(row, 'TYPE').toLowerCase();
      const content = col(row, 'CONTENT');
      if (type === 'section') {
        pages.push({
          name: clip(content.trim() || names.noSection, 100),
          icon: null,
          view_type: 'list',
          reset_cycle: 'none',
          items: [],
        });
        stack = [];
        last = null;
        continue;
      }
      if (type === 'note') {
        if (last && content)
          last.notes = clip([last.notes, content].filter(Boolean).join('\n\n'), NOTES_MAX);
        continue;
      }
      if (type !== 'task') continue;
      // "@compras" no texto vira etiqueta; o resto é o título (o Markdown fica)
      const labels: string[] = [];
      const text = title(
        content.replace(/(^|\s)@([\p{L}\p{N}_-]+)/gu, (_, space: string, name: string) => {
          labels.push(name);
          return space;
        }),
      );
      if (!text) continue;
      if (col(row, 'CHECKED') === '1' || /^(true|yes)$/i.test(col(row, 'CHECKED'))) {
        done++;
        continue;
      }
      const priority = Number(col(row, 'PRIORITY'));
      const item: ImportItem = {
        id: newId(),
        title: text,
        priority: priority >= 1 && priority <= 3 ? 4 - priority : 0,
        labels: uniqueLabels(labels),
        children: [],
      };
      const description = col(row, 'DESCRIPTION');
      if (description) item.notes = clip(description, NOTES_MAX);
      const date = col(row, 'DATE');
      if (date) {
        const recurrence = todoistRecurrence(date);
        const due = recurrence ? null : todoistDate(date, today, col(row, 'DATE_LANG'));
        if (recurrence) item.recurrence = recurrence;
        else if (due) item.due_date = due;
        else {
          unreadDates++;
          item.notes = clip(
            [`${names.dateNote}: ${date}`, item.notes].filter(Boolean).join('\n\n'),
            NOTES_MAX,
          );
        }
      }
      const level = Math.min(Math.max(Math.trunc(Number(col(row, 'INDENT')) || 1), 1), DEPTH_MAX);
      const page = pages[pages.length - 1];
      // Nível sem pai (pulou um nível) cai no mais fundo que existe
      const parent = level > 1 ? stack[Math.min(level, stack.length + 1) - 2] : undefined;
      if (parent && parent.children.length < CHILDREN_MAX) parent.children.push(item);
      else page.items.push(item);
      const depth = parent ? stack.indexOf(parent) + 2 : 1;
      stack = [...stack.slice(0, depth - 1), item];
      last = item;
    }
    // Sem seções, a lista leva o nome do projeto
    const name = todoistProjectName(file.name);
    if (pages.length === 1) pages[0].name = name;
    projects.push({ name, icon: '📋', pages });
  }
  return finish('todoist', projects, { done, rewards: 0 }, unreadDates);
}

/** Projeto → `p_data` do create_from_template */
export function projectData(project: ImportProject) {
  return {
    pages: project.pages.map((p) => ({
      name: p.name,
      icon: p.icon,
      view_type: p.view_type,
      reset_cycle: p.reset_cycle,
      items: p.items,
    })),
  };
}
