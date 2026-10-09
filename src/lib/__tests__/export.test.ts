import { describe, expect, test } from '@jest/globals';

import { tasksToCsv } from '../export';

describe('tasksToCsv', () => {
  test('cabeçalho em pt-BR, ";" como separador e BOM', () => {
    const csv = tasksToCsv([
      { title: 'Carne', folder: 'Churrasco', status: 'todo', labels: ['mercado', 'carne'] },
    ]);
    expect(csv.startsWith('﻿Tarefa;Pasta;Página')).toBe(true);
    expect(csv).toContain('Carne;Churrasco;;todo;;;mercado carne;;;\r\n');
  });
  test('aspas, ";" e quebra de linha ficam protegidos', () => {
    const csv = tasksToCsv([{ title: 'a "b"; c', notes: 'linha 1\nlinha 2' }]);
    expect(csv).toContain('"a ""b""; c"');
    expect(csv).toContain('"linha 1\nlinha 2"');
  });
});
