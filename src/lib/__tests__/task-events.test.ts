import { describe, expect, it } from '@jest/globals';

import { byDay, EVENT_GROUPS, EVENT_KINDS, eventMessage, eventsCsv } from '../task-events';

describe('eventMessage', () => {
  it('usa o nome de quem fez e os dados do evento', () => {
    expect(
      eventMessage(
        {
          kind: 'moved',
          payload: { from: 'Compras', to: 'Preparo' },
          actor: { display_name: 'Greg' },
        },
        'Alguém',
      ),
    ).toEqual({
      key: 'events.moved',
      params: expect.objectContaining({ who: 'Greg', from: 'Compras', to: 'Preparo' }),
    });
  });

  it('sem pessoa (servidor ou conta apagada) vira "Alguém"', () => {
    expect(eventMessage({ kind: 'completed', payload: {}, actor: null }, 'Alguém').params.who).toBe(
      'Alguém',
    );
  });

  it('forçar diz se foi o início ou a conclusão', () => {
    const m = eventMessage({ kind: 'forced', payload: { action: 'complete' } }, 'Alguém');
    expect(m.key).toBe('events.forced');
    expect(m.params.context).toBe('complete');
  });

  it('tipo desconhecido não quebra', () => {
    expect(eventMessage({ kind: 'novo', payload: null }, 'Alguém').key).toBe('events.other');
  });
});

describe('eventsCsv', () => {
  it('escapa vírgula, aspas e quebra de linha', () => {
    expect(
      eventsCsv(
        [
          {
            at: '2026-10-14 10:00',
            who: 'Greg',
            kind: 'completed',
            title: 'Carvão, 2 kg',
            text: 'Disse "ok"',
          },
        ],
        ['Data', 'Pessoa', 'Tipo', 'Tarefa', 'O que aconteceu'],
      ),
    ).toBe(
      'Data,Pessoa,Tipo,Tarefa,O que aconteceu\n2026-10-14 10:00,Greg,completed,"Carvão, 2 kg","Disse ""ok"""',
    );
  });
});

describe('grupos e dias', () => {
  it('todo tipo está em exatamente um grupo', () => {
    const grouped = Object.values(EVENT_GROUPS).flat();
    expect([...grouped].sort()).toEqual([...EVENT_KINDS].sort());
  });

  it('agrupa por dia mantendo a ordem', () => {
    const days = byDay(
      [
        { at: '2026-10-14T20:00:00Z' },
        { at: '2026-10-14T08:00:00Z' },
        { at: '2026-10-13T23:00:00Z' },
      ],
      (at) => at.slice(0, 10),
    );
    expect(days.map((d) => [d.day, d.events.length])).toEqual([
      ['2026-10-14', 2],
      ['2026-10-13', 1],
    ]);
  });
});
