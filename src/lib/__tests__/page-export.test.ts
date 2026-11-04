import { describe, expect, test } from '@jest/globals';

import { parseBatchInput } from '../parser/batch';
import {
  exportFileName,
  exportRows,
  pageToCsv,
  pageToMarkdown,
  pageToPrintHtml,
  type ExportStrings,
  type ExportTask,
} from '../page-export';

const task = (over: Partial<ExportTask> & Pick<ExportTask, 'id' | 'title'>): ExportTask => ({
  parent_task_id: null,
  position: 1,
  status: 'todo',
  priority: 0,
  due_date: null,
  labels: [],
  notes: null,
  ...over,
});

// Fora de ordem de propósito: a exportação segue a árvore e a posição
const TASKS = [
  task({ id: 'b', title: 'Bebidas', position: 2 }),
  task({ id: 'b1', title: 'Cerveja "gelada"; long neck', parent_task_id: 'b', status: 'done' }),
  task({
    id: 'a',
    title: 'Carne',
    position: 1,
    priority: 2,
    labels: ['açougue'],
    due_date: '2026-11-07',
    due_time: '09:30:00',
    notes: 'picanha\n2 kg',
  }),
];

const S: ExportStrings = {
  code: 'Nº',
  task: 'Tarefa',
  done: 'Feita',
  due: 'Vence',
  priority: 'Prioridade',
  labels: 'Etiquetas',
  notes: 'Descrição',
  yes: 'sim',
  generated: 'Exportada em 04/11/2026',
  progress: '1 de 3 feitas',
  date: (iso) => iso.split('-').reverse().join('/'),
};

describe('exportar a lista (PB9)', () => {
  test('ordem da árvore, com código e nível', () => {
    expect(exportRows(TASKS).map((r) => [r.code, r.level, r.task.id])).toEqual([
      ['1', 0, 'a'],
      ['2', 0, 'b'],
      ['2.1', 1, 'b1'],
    ]);
  });

  test('CSV: BOM, ";" e aspas onde precisa; data com hora', () => {
    const csv = pageToCsv(TASKS, S);
    expect(csv.startsWith('﻿Nº;Tarefa;Feita;Vence;Prioridade;Etiquetas;Descrição\r\n')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines[1]).toBe('1;Carne;;2026-11-07 09:30;2;açougue;"picanha\n2 kg"');
    expect(lines[2]).toBe('2;Bebidas;;;;;');
    expect(lines[3]).toBe('2.1;"Cerveja ""gelada""; long neck";sim;;;;');
  });

  test('Markdown: caixinhas, recuo, sintaxe rápida e descrição como citação', () => {
    expect(pageToMarkdown('Churrasco', TASKS)).toBe(
      [
        '# Churrasco',
        '',
        '- [ ] Carne !! #açougue 📅 2026-11-07',
        '  > picanha',
        '  > 2 kg',
        '- [ ] Bebidas',
        '  - [x] Cerveja "gelada"; long neck',
        '',
      ].join('\n'),
    );
  });

  test('o Markdown volta pelo "Adicionar várias" com a árvore, a prioridade e o feito', () => {
    const md = pageToMarkdown(
      'X',
      TASKS.map((t) => ({ ...t, notes: null })),
    );
    const items = parseBatchInput(md.split('\n').slice(2).join('\n'), { today: '2026-11-04' });
    expect(items.map((i) => i.title)).toEqual(['Carne', 'Bebidas']);
    expect(items[0]).toMatchObject({
      priority: 2,
      labels: ['açougue'],
      dueDate: '2026-11-07',
      done: false,
    });
    expect(items[1].children[0]).toMatchObject({ done: true });
  });

  test('HTML para imprimir: escapa o texto, risca o feito e recua', () => {
    const page = pageToPrintHtml('<Festa>', TASKS, S);
    expect(page).toContain('<title>&lt;Festa&gt;</title>');
    expect(page).toContain('Vence: 07/11/2026');
    expect(page).toContain('picanha<br>2 kg');
    expect(page).toContain('class="done" style="margin-left:1.5em"');
    expect(page).toContain('Cerveja &quot;gelada&quot;; long neck');
    expect(page).toContain('1 de 3 feitas · Exportada em 04/11/2026');
  });

  test('nome do arquivo', () => {
    expect(exportFileName('Compras: casa/praia?', 'csv')).toBe('Compras casa praia.csv');
    expect(exportFileName('a  b', 'csv')).toBe('a b.csv');
    expect(exportFileName('  ', 'md')).toBe('lista.md');
  });
});
