import { describe, expect, it } from '@jest/globals';

import { buildFlow, flowSteps, laneOrder, type FlowDep, type FlowTask } from '../flow-graph';
import { layoutFlow } from '../flow-layout';

const NOW = new Date('2026-10-14T12:00:00Z');

function task(id: string, extra: Partial<FlowTask> = {}): FlowTask {
  return {
    id,
    title: id,
    page_id: 'p',
    parent_task_id: null,
    status: 'todo',
    completed_at: null,
    started_at: null,
    deps_mode: 'all',
    estimate_minutes: null,
    ...extra,
  };
}
const dep = (taskId: string, on: string, lag = 0): FlowDep => ({
  id: `${on}>${taskId}`,
  task_id: taskId,
  depends_on_task_id: on,
  lag_minutes: lag,
});
const map = (...list: FlowTask[]) => new Map(list.map((t) => [t.id, t]));
const done = { status: 'done', completed_at: '2026-10-14T10:00:00Z' };

describe('buildFlow', () => {
  it('só entram as tarefas ligadas, em etapas pelo caminho mais longo', () => {
    // carvão → fogo → carne; tempero → carne; solta fica fora
    const g = buildFlow({
      tasks: map(task('carvão'), task('fogo'), task('carne'), task('tempero'), task('solta')),
      deps: [dep('fogo', 'carvão'), dep('carne', 'fogo'), dep('carne', 'tempero')],
      people: new Map(),
      now: NOW,
    });
    expect(Object.fromEntries(g.nodes.map((n) => [n.id, n.rank]))).toEqual({
      carvão: 0,
      tempero: 0,
      fogo: 1,
      carne: 2,
    });
    expect(flowSteps(g.nodes).map((s) => s.map((n) => n.id))).toEqual([
      ['carvão', 'tempero'],
      ['fogo'],
      ['carne'],
    ]);
  });

  it('fronteira: prontas e em andamento; a minha é destacada', () => {
    const g = buildFlow({
      tasks: map(
        task('carvão', done),
        task('fogo'),
        task('carne', { started_at: NOW.toISOString() }),
      ),
      deps: [dep('fogo', 'carvão'), dep('carne', 'fogo')],
      people: new Map([['fogo', [{ userId: 'eu', name: 'Willian' }]]]),
      me: 'eu',
      hideDone: false,
      now: NOW,
    });
    const by = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(by.fogo.state).toBe('ready');
    expect(by.fogo.frontier).toBe(true);
    expect(by.fogo.mine).toBe(true);
    // iniciada, mas o fogo ainda não foi: continua bloqueada
    expect(by.carne.state).toBe('blocked');
    expect(by.carne.frontier).toBe(false);
    expect(g.edges.find((e) => e.target === 'fogo')?.met).toBe(true);
    expect(g.edges.find((e) => e.target === 'carne')?.met).toBe(false);
  });

  it('esconde os galhos concluídos, mas mantém a concluída que libera uma aberta', () => {
    const g = buildFlow({
      tasks: map(task('a', done), task('b', done), task('c')),
      deps: [dep('b', 'a'), dep('c', 'b')],
      people: new Map(),
      now: NOW,
    });
    expect(g.nodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(g.hiddenDone).toBe(1);
    expect(g.edges.map((e) => e.id)).toEqual(['b>c']);
  });

  it('caminho crítico pelas estimativas do que falta, com o atraso pendente', () => {
    // a(30) → c(60); b(10) → c, com 45 min de espera; d(5) solto depois de a
    const g = buildFlow({
      tasks: map(
        task('a', { estimate_minutes: 30 }),
        task('b', { estimate_minutes: 10 }),
        task('c', { estimate_minutes: 60 }),
        task('d', { estimate_minutes: 5 }),
      ),
      deps: [dep('c', 'a'), dep('c', 'b', 45), dep('d', 'a')],
      people: new Map(),
      now: NOW,
    });
    // b + 45 + c = 115 > a + c = 90
    expect(g.critical).toEqual({ minutes: 115, count: 2 });
    expect(g.nodes.filter((n) => n.critical).map((n) => n.id)).toEqual(['b', 'c']);
    expect(g.edges.filter((e) => e.critical).map((e) => e.id)).toEqual(['b>c']);
  });

  it('sem estimativas, sem caminho crítico', () => {
    const g = buildFlow({
      tasks: map(task('a'), task('b')),
      deps: [dep('b', 'a')],
      people: new Map(),
      now: NOW,
    });
    expect(g.critical).toBeNull();
    expect(g.nodes.some((n) => n.critical)).toBe(false);
  });

  it('dado antigo com ciclo não trava', () => {
    const g = buildFlow({
      tasks: map(task('a'), task('b')),
      deps: [dep('b', 'a'), dep('a', 'b')],
      people: new Map(),
      now: NOW,
    });
    expect(g.nodes).toHaveLength(2);
  });
});

describe('laneOrder', () => {
  it('minha raia primeiro, sem responsável por último', () => {
    const lanes = ['', 'Greg', 'Willian', 'Ana'].map((lane) => ({ lane }));
    expect(laneOrder(lanes as never, 'Willian')).toEqual(['Willian', 'Ana', 'Greg', '']);
  });
});

describe('layoutFlow', () => {
  it('da esquerda para a direita; com raias, cada pessoa na sua faixa', () => {
    const g = buildFlow({
      tasks: map(task('carvão'), task('fogo'), task('tempero')),
      deps: [dep('fogo', 'carvão'), dep('fogo', 'tempero')],
      people: new Map([
        ['carvão', [{ userId: 'g', name: 'Greg' }]],
        ['fogo', [{ userId: 'w', name: 'Willian' }]],
      ]),
      now: NOW,
    });
    const free = layoutFlow(g.nodes, g.edges);
    expect(free.positions.get('fogo')!.x).toBeGreaterThan(free.positions.get('carvão')!.x);

    const laned = layoutFlow(g.nodes, g.edges, { lanes: true, myName: 'Willian' });
    expect(laned.lanes.map((l) => l.name)).toEqual(['Willian', 'Greg', '']);
    for (const lane of laned.lanes) {
      const inside = g.nodes.filter((n) => n.lane === lane.name);
      for (const n of inside) {
        const y = laned.positions.get(n.id)!.y;
        expect(y).toBeGreaterThanOrEqual(lane.y);
        expect(y).toBeLessThan(lane.y + lane.height);
      }
    }
  });
});
