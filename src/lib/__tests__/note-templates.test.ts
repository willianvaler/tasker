import { describe, expect, it } from '@jest/globals';

import {
  dailyNoteDays,
  findDailyNote,
  isDailyNote,
  isDayTitle,
  renderTemplate,
  timeIn,
} from '../note-templates';

const note = (id: string, title: string, extra: object = {}) => ({
  id,
  title,
  folder_id: null as string | null,
  is_template: false,
  created_at: `2026-11-0${id}T10:00:00Z`,
  ...extra,
});

describe('nota do dia (OB5)', () => {
  it('reconhece o título de dia', () => {
    expect(isDayTitle('2026-11-03')).toBe(true);
    expect(isDayTitle(' 2026-11-03 ')).toBe(true);
    expect(isDayTitle('2026-11-3')).toBe(false);
    expect(isDayTitle('Reunião 2026-11-03')).toBe(false);
  });

  it('não conta a de pasta nem o modelo', () => {
    expect(isDailyNote(note('1', '2026-11-03'))).toBe(true);
    expect(isDailyNote(note('1', '2026-11-03', { folder_id: 'f' }))).toBe(false);
    expect(isDailyNote(note('1', '2026-11-03', { is_template: true }))).toBe(false);
  });

  it('acha a mais antiga do dia e monta o mapa do calendário', () => {
    const list = [note('3', '2026-11-03'), note('2', '2026-11-03'), note('4', '2026-11-04')];
    expect(findDailyNote(list, '2026-11-03')?.id).toBe('2');
    expect(findDailyNote(list, '2026-11-05')).toBeUndefined();
    expect(dailyNoteDays(list)).toEqual({ '2026-11-03': '2', '2026-11-04': '4' });
  });
});

describe('modelos (OB5)', () => {
  const values = { date: '2026-11-03', time: '08:30', title: 'Diário' };

  it('troca as variáveis nos três idiomas', () => {
    expect(renderTemplate('# {{titulo}} — {{data}} às {{hora}}', values)).toBe(
      '# Diário — 2026-11-03 às 08:30',
    );
    expect(renderTemplate('{{date}} {{time}} {{title}}', values)).toBe('2026-11-03 08:30 Diário');
    expect(renderTemplate('{{ fecha }} {{Título}} {{HOJE}}', values)).toBe(
      '2026-11-03 Diário 2026-11-03',
    );
  });

  it('deixa como está o que não é variável', () => {
    expect(renderTemplate('{{nome}} e {{}} e {data}', values)).toBe('{{nome}} e {{}} e {data}');
  });

  it('hora no fuso', () => {
    const at = new Date('2026-11-03T11:05:00Z');
    expect(timeIn('America/Sao_Paulo', at)).toBe('08:05');
    expect(timeIn('UTC', at)).toBe('11:05');
  });
});
