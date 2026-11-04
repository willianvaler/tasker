import { describe, expect, test } from '@jest/globals';

import {
  habiticaRecurrence,
  importHabitica,
  importTodoist,
  isHabiticaExport,
  isTodoistCsv,
  labelName,
  parseCsv,
  projectData,
  todoistDate,
  todoistProjectName,
  todoistRecurrence,
  type ImportNames,
} from '../import-apps';

const names: ImportNames = {
  habitica: 'Habitica',
  habits: 'Hábitos',
  dailies: 'Diárias',
  todos: 'Afazeres',
  noSection: 'Sem seção',
  dateNote: 'Data no Todoist',
};
const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const opts = () => ({ today: '2026-11-04', newId: counter(), names });

describe('Habitica (PC1)', () => {
  const exported = {
    tags: [{ id: 't1', name: 'Saúde Física' }],
    tasks: {
      habits: [
        { text: 'Beber água', up: true, down: false, tags: ['t1'] },
        { text: 'Refrigerante', up: false, down: true },
        { text: 'Postura', up: true, down: true, notes: 'costas retas' },
      ],
      dailys: [
        {
          text: 'Alongar',
          frequency: 'weekly',
          repeat: { su: false, m: true, t: false, w: true, th: false, f: true, s: false },
        },
        {
          text: 'Meditar',
          frequency: 'daily',
          everyX: 1,
          checklist: [{ text: 'respirar', completed: true }],
        },
      ],
      todos: [
        {
          text: 'Relatório',
          priority: 2,
          date: '2026-11-10T03:00:00.000Z',
          checklist: [
            { text: 'Introdução', completed: false },
            { text: 'Capa', completed: true },
          ],
        },
        { text: 'Antigo', completed: true },
        { text: '   ' },
      ],
      rewards: [{ text: 'Pizza' }],
    },
  };

  test('reconhece o arquivo', () => {
    expect(isHabiticaExport(exported)).toBe(true);
    expect(isHabiticaExport([{ type: 'todo', text: 'x' }])).toBe(true);
    expect(isHabiticaExport({ tasks: [] })).toBe(false);
    expect(isHabiticaExport('x')).toBe(false);
  });

  test('hábitos, diárias e afazeres em três listas', () => {
    const plan = importHabitica(exported, opts());
    expect(plan.projects).toHaveLength(1);
    const [habits, dailies, todos] = plan.projects[0].pages;
    expect(habits).toMatchObject({ name: 'Hábitos', view_type: 'habits', reset_cycle: 'daily' });
    expect(habits.items.map((i) => [i.title, i.habit_kind, i.habit_sides])).toEqual([
      ['Beber água', 'plusminus', 'up'],
      ['Refrigerante', 'plusminus', 'down'],
      ['Postura', 'plusminus', 'both'],
    ]);
    expect(habits.items[0].labels).toEqual(['saúde-física']);
    expect(dailies.items[0].recurrence).toEqual({ type: 'weekdays', days: [1, 3, 5] });
    expect(dailies.items[1]).toMatchObject({
      recurrence: { type: 'daily' },
      notes: '[x] respirar',
    });
    expect(todos.items).toHaveLength(1);
    expect(todos.items[0]).toMatchObject({
      title: 'Relatório',
      priority: 2,
      due_date: '2026-11-10',
    });
    expect(todos.items[0].children.map((c) => c.title)).toEqual(['Introdução']);
    expect(plan.tasks).toBe(7);
    // "Antigo" e a "Capa" já estavam feitos
    expect(plan.skipped).toEqual({ done: 2, rewards: 1, overLimit: 0 });
  });

  test('recorrência das diárias', () => {
    expect(habiticaRecurrence({ frequency: 'daily', everyX: 3 })).toEqual({ type: 'daily' });
    expect(habiticaRecurrence({ frequency: 'monthly' })).toEqual({ type: 'monthly' });
    expect(habiticaRecurrence({ frequency: 'weekly', repeat: {} })).toEqual({ type: 'daily' });
    const none = Object.fromEntries(['su', 'm', 't', 'w', 'th', 'f', 's'].map((k) => [k, false]));
    expect(habiticaRecurrence({ frequency: 'weekly', repeat: none })).toEqual({ type: 'weekly' });
  });

  test('lista grande vira várias e o projeto para em 30 listas', () => {
    const todos = Array.from({ length: 1200 }, (_, i) => ({ text: `T${i}` }));
    const plan = importHabitica({ tasks: { todos } }, opts());
    const pages = plan.projects[0].pages;
    expect(pages.map((p) => [p.name, p.items.length])).toEqual([
      ['Afazeres', 500],
      ['Afazeres (2)', 500],
      ['Afazeres (3)', 200],
    ]);
    const huge = Array.from({ length: 15100 }, (_, i) => ({ text: `T${i}` }));
    const big = importHabitica({ tasks: { todos: huge } }, opts());
    expect(big.projects[0].pages).toHaveLength(30);
    expect(big.skipped.overLimit).toBe(100);
  });
});

describe('Todoist (PC1)', () => {
  const csv = [
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
    'task,Comprar pão @mercado,,4,1,Ana,,amanhã,pt,',
    'note,"Integral, de preferência",,,,Ana,,,,',
    'section,Trabalho,,,,,,,,',
    'task,"Relatório ""Q4""",Ver os números,1,1,Ana,,2026-11-20,en,',
    'task,Gráficos,,2,2,Ana,,every monday,en,',
    'task,Cores,,4,3,Ana,,,,',
    'task,Revisar,,3,2,Ana,,quando der,pt,',
    'task,Reunião semanal,,4,1,Ana,,toda segunda e quarta,pt,',
    '',
  ].join('\r\n');

  test('CSV com aspas e quebra de linha', () => {
    expect(parseCsv('a,b\n"x, y","linha\nnova"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'linha\nnova'],
    ]);
    expect(parseCsv('﻿a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(isTodoistCsv(csv)).toBe(true);
    expect(isTodoistCsv('nome,valor\n')).toBe(false);
  });

  test('seções viram listas, recuo vira subtarefa', () => {
    const plan = importTodoist([{ name: 'Casa [2203306141].csv', text: csv }], opts());
    expect(plan.projects.map((p) => p.name)).toEqual(['Casa']);
    const [loose, work] = plan.projects[0].pages;
    expect(loose.name).toBe('Sem seção');
    expect(loose.items[0]).toMatchObject({
      title: 'Comprar pão',
      labels: ['mercado'],
      due_date: '2026-11-05',
      notes: 'Integral, de preferência',
      priority: 0,
    });
    expect(work.name).toBe('Trabalho');
    const report = work.items[0];
    expect(report).toMatchObject({
      title: 'Relatório "Q4"',
      notes: 'Ver os números',
      priority: 3,
      due_date: '2026-11-20',
    });
    expect(report.children.map((c) => c.title)).toEqual(['Gráficos', 'Revisar']);
    expect(report.children[0]).toMatchObject({
      priority: 2,
      recurrence: { type: 'weekdays', days: [1] },
    });
    expect(report.children[0].children.map((c) => c.title)).toEqual(['Cores']);
    expect(report.children[1].notes).toBe('Data no Todoist: quando der');
    expect(work.items[1].recurrence).toEqual({ type: 'weekdays', days: [1, 3] });
    expect(plan.unreadDates).toBe(1);
    expect(plan.tasks).toBe(6);
  });

  test('projeto sem seção: a lista leva o nome dele', () => {
    const plan = importTodoist(
      [{ name: 'Inbox.csv', text: 'TYPE,CONTENT,PRIORITY,INDENT\ntask,Ligar,4,1\n' }],
      opts(),
    );
    expect(plan.projects[0].pages.map((p) => p.name)).toEqual(['Inbox']);
  });

  test('datas e repetições', () => {
    expect(todoistRecurrence('every day')).toEqual({ type: 'daily' });
    expect(todoistRecurrence('every day at 9am')).toEqual({ type: 'daily' });
    expect(todoistRecurrence('todo mês')).toEqual({ type: 'monthly' });
    expect(todoistRecurrence('cada semana')).toEqual({ type: 'weekly' });
    expect(todoistRecurrence('every weekday')).toEqual({ type: 'weekdays', days: [1, 2, 3, 4, 5] });
    expect(todoistRecurrence('every mon, fri')).toEqual({ type: 'weekdays', days: [1, 5] });
    expect(todoistRecurrence('tomorrow')).toBeNull();
    expect(todoistDate('Nov 10', '2026-11-04', 'en')).toBe('2026-11-10');
    expect(todoistDate('10/11', '2026-11-04', 'pt')).toBe('2026-11-10');
    expect(todoistDate('10 de novembro de 2027', '2026-11-04', 'pt')).toBe('2027-11-10');
    expect(todoistDate('Dec 1', '2026-11-04', 'en')).toBe('2026-12-01');
    expect(todoistDate('qualquer hora', '2026-11-04', 'pt')).toBeNull();
    expect(todoistProjectName('backup/Trabalho [123].csv')).toBe('Trabalho');
  });

  test('formato do create_from_template', () => {
    const plan = importTodoist([{ name: 'Casa.csv', text: csv }], opts());
    const data = projectData(plan.projects[0]);
    expect(data.pages[1]).toMatchObject({
      name: 'Trabalho',
      view_type: 'list',
      reset_cycle: 'none',
    });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

test('etiqueta no formato do app', () => {
  expect(labelName('Trabalho 💼')).toBe('trabalho');
  expect(labelName('  Saúde  Física ')).toBe('saúde-física');
  expect(labelName('🎉')).toBe('');
});
