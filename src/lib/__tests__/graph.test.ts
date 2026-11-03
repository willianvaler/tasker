import { describe, expect, it } from '@jest/globals';

import {
  bounds,
  buildGraph,
  filterGraph,
  forceLayout,
  neighborhood,
  type GraphKind,
  type GraphLinkRow,
} from '../graph';

const link = (
  from: string,
  to: string | null,
  title = '',
  kinds: ['note' | 'task', GraphLinkRow['target_kind']] = ['note', 'note'],
): GraphLinkRow => ({
  source_kind: kinds[0],
  source_id: from,
  target_kind: to ? kinds[1] : null,
  target_id: to,
  target_title: title,
});

const ALL: GraphKind[] = ['note', 'task', 'page', 'folder', 'ghost'];

describe('grafo (OB9)', () => {
  const graph = buildGraph({
    notes: [
      { id: 'a', title: 'A', tags: ['treino/perna'], folderId: 'f1' },
      { id: 'b', title: 'B', tags: ['leitura'] },
      { id: 'c', title: 'C' },
      { id: 'solta', title: 'Solta' },
    ],
    tasks: new Map([['t1', { id: 't1', title: 'Tarefa', tags: ['casa'], folderId: 'f1' }]]),
    pages: [{ id: 'p1', title: 'Mercado', folderId: 'f1' }],
    folders: [{ id: 'f1', title: 'Casa' }],
    links: [
      link('a', 'b'),
      link('b', 'a'), // o mesmo par: uma linha só
      link('b', 'c'),
      link('a', 't1', '', ['note', 'task']),
      link('t1', 'p1', '', ['task', 'page']),
      link('c', null, 'Nova ideia'),
      link('a', null, 'nova IDEIA'), // mesmo fantasma
      link('a', 'sem-acesso'), // destino que a pessoa não vê
      link('estranha', 'a'), // origem que a pessoa não vê
      link('a', 'a'), // para si mesma
    ],
  });

  it('monta pontos e linhas', () => {
    expect(graph.nodes.map((n) => n.key).sort()).toEqual([
      'ghost:nova ideia',
      'note:a',
      'note:b',
      'note:c',
      'note:solta',
      'page:p1',
      'task:t1',
    ]);
    expect(graph.edges).toHaveLength(6);
    const a = graph.nodes.find((n) => n.key === 'note:a')!;
    expect(a.degree).toBe(3);
    expect(graph.nodes.find((n) => n.kind === 'ghost')!.title).toBe('Nova ideia');
  });

  it('vizinhos até 2 passos', () => {
    expect([...neighborhood(graph, 'note:c', 1)].sort()).toEqual([
      'ghost:nova ideia',
      'note:b',
      'note:c',
    ]);
    expect(neighborhood(graph, 'note:c', 2).has('note:a')).toBe(true);
    expect(neighborhood(graph, 'note:c', 2).has('task:t1')).toBe(false);
  });

  it('filtros', () => {
    const notes = filterGraph(graph, { kinds: ['note'], orphans: false });
    expect(notes.nodes.map((n) => n.key).sort()).toEqual(['note:a', 'note:b', 'note:c']);
    expect(notes.edges).toHaveLength(2);
    expect(filterGraph(graph, { kinds: ['note'], orphans: true }).nodes).toHaveLength(4);
    // Etiqueta aninhada
    expect(
      filterGraph(graph, { kinds: ALL, orphans: true, tag: '#Treino' }).nodes.map((n) => n.key),
    ).toEqual(['note:a']);
    expect(
      filterGraph(graph, { kinds: ALL, orphans: true, folderIds: ['f1'] })
        .nodes.map((n) => n.key)
        .sort(),
    ).toEqual(['note:a', 'page:p1', 'task:t1']);
    const local = filterGraph(graph, { kinds: ALL, orphans: false, focus: 'task:t1', depth: 1 });
    expect(local.nodes.map((n) => n.key).sort()).toEqual(['note:a', 'page:p1', 'task:t1']);
    // O foco fica mesmo sem ligação nem do tipo escolhido
    expect(
      filterGraph(graph, { kinds: ['task'], orphans: false, focus: 'note:solta' }).nodes,
    ).toHaveLength(1);
  });

  it('layout: determinístico, separa os pontos', () => {
    const one = forceLayout(graph);
    const two = forceLayout(graph);
    expect([...one.entries()]).toEqual([...two.entries()]);
    const points = [...one.values()];
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(
          20,
        );
    // Ligados ficam mais perto que a solta
    const d = (p: string, q: string) =>
      Math.hypot(one.get(p)!.x - one.get(q)!.x, one.get(p)!.y - one.get(q)!.y);
    expect(d('note:a', 'note:b')).toBeLessThan(d('note:a', 'note:solta'));
    expect(forceLayout({ nodes: [], edges: [] }).size).toBe(0);
    expect(bounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});
