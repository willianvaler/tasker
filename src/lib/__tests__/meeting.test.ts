import { describe, expect, it } from '@jest/globals';

import {
  MEETING_DEFAULTS,
  buildMinutes,
  findActions,
  nextItem,
  nextMeetingDate,
  plannedMinutes,
  readMeeting,
  writeMeeting,
} from '../meeting';

describe('readMeeting', () => {
  it('sem configuração, os padrões', () => {
    expect(readMeeting(null)).toEqual(MEETING_DEFAULTS);
    expect(readMeeting({ base: 1 })).toEqual(MEETING_DEFAULTS);
  });
  it('lê o que é válido e ignora o resto', () => {
    const m = readMeeting({
      meeting: {
        date: '2026-11-24',
        time: '9:00',
        duration: 9999,
        place: '  ',
        participants: ['a', 3, 'b'],
        status: 'running',
        repeat: 'weekly',
        notes: 'oi',
      },
    });
    expect(m.date).toBe('2026-11-24');
    expect(m.time).toBeNull();
    expect(m.duration).toBe(60);
    expect(m.place).toBeNull();
    expect(m.participants).toEqual(['a', 'b']);
    expect(m.status).toBe('running');
    expect(m.repeat).toBe('weekly');
    expect(m.notes).toBe('oi');
  });
  it('writeMeeting guarda junto do resto da configuração', () => {
    const config = writeMeeting({ other: true }, { ...MEETING_DEFAULTS, place: 'Sala 2' });
    expect((config as { other?: boolean }).other).toBe(true);
    expect(readMeeting(config).place).toBe('Sala 2');
  });
});

describe('findActions', () => {
  it('cada [ ] vira uma ação; [x] e texto solto não', () => {
    const text = [
      'Combinamos o orçamento.',
      '[ ] mandar a proposta @Ana até sexta',
      '- [ ] revisar o contrato !!',
      '  * [ ]   ligar para o fornecedor  ',
      '- [x] já feito',
      '[] sem espaço não vale',
    ].join('\n');
    expect(findActions(text)).toEqual([
      'mandar a proposta @Ana até sexta',
      'revisar o contrato !!',
      'ligar para o fornecedor',
    ]);
  });
});

describe('pauta', () => {
  it('nextItem pula os discutidos e o atual', () => {
    expect(nextItem(['a', 'b', 'c'], [], null)).toBe('a');
    expect(nextItem(['a', 'b', 'c'], ['a'], 'b')).toBe('c');
    expect(nextItem(['a', 'b'], ['a', 'b'], null)).toBeNull();
  });
  it('plannedMinutes soma o previsto', () => {
    expect(
      plannedMinutes([
        { estimate_minutes: 10 },
        { estimate_minutes: null },
        { estimate_minutes: 5 },
      ]),
    ).toBe(15);
  });
  it('nextMeetingDate pela repetição', () => {
    expect(nextMeetingDate('2026-11-24', 'weekly', '2026-11-21')).toBe('2026-12-01');
    expect(nextMeetingDate('2026-11-24', 'biweekly', '2026-11-21')).toBe('2026-12-08');
    expect(nextMeetingDate(null, 'none', '2026-11-21')).toBe('2026-11-28');
  });
});

describe('buildMinutes', () => {
  it('monta a ata com presença, pauta, anotações e ações', () => {
    const md = buildMinutes({
      title: 'Semanal',
      date: '2026-11-24',
      time: '09:00',
      place: 'Sala 2',
      present: ['Ana', 'Bia'],
      absent: ['Caio'],
      items: [
        { title: 'Orçamento', presenter: 'Ana', notes: 'Aprovado.', discussed: true },
        { title: 'Viagem', presenter: null, notes: '', discussed: false },
      ],
      notes: 'Próxima com o cliente.',
      actions: [{ title: 'mandar a proposta', who: 'Ana' }],
    });
    expect(md).toBe(
      [
        '2026-11-24 09:00 · Sala 2',
        '',
        '**Presentes:** Ana, Bia',
        '**Ausentes:** Caio',
        '',
        '## Pauta',
        '',
        '### 1. Orçamento (Ana)',
        '',
        'Aprovado.',
        '',
        '### 2. Viagem — não discutido',
        '',
        '## Anotações',
        '',
        'Próxima com o cliente.',
        '',
        '## Ações',
        '',
        '- [ ] mandar a proposta (Ana)',
        '',
      ].join('\n'),
    );
  });
});
