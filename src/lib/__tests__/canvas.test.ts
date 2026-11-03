import { describe, expect, it } from '@jest/globals';

import {
  addEdge,
  addNode,
  cardFile,
  cardRef,
  exportCanvas,
  groupOf,
  importCanvas,
  isImageUrl,
  mergeCanvas,
  placeNew,
  readCanvas,
  removeNodes,
  updateEdge,
  updateNode,
  type Canvas,
} from '../canvas';

const NOTE = '0190a1b2-0000-7000-8000-000000000001';
const TASK = '0190a1b2-0000-7000-8000-000000000002';

const sample: Canvas = readCanvas({
  nodes: [
    { id: 'g', type: 'group', x: -20, y: -20, width: 600, height: 300, label: 'Casa', color: '4' },
    { id: 'a', type: 'text', x: 0, y: 0, width: 240, height: 120, text: 'Ideia' },
    { id: 'n', type: 'file', x: 300, y: 0, width: 260, height: 100, file: cardFile('note', NOTE) },
    { id: 't', type: 'file', x: 700, y: 0, width: 260, height: 100, file: cardFile('task', TASK) },
  ],
  edges: [{ id: 'e1', fromNode: 'a', toNode: 'n', label: 'vira' }],
});

describe('canvas (OB10)', () => {
  it('lê o JSON Canvas e descarta o que não vale', () => {
    const c = readCanvas({
      nodes: [
        { id: 'a', type: 'text', x: 1.6, y: 'x', text: 'oi', color: '#ff0000' },
        { id: 'a', type: 'text', x: 0, y: 0 },
        { id: 'b', type: 'banana', x: 0, y: 0 },
        {
          id: 'c',
          type: 'link',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          url: 'https://x.dev/a.png',
          text: 'fora',
        },
      ],
      edges: [
        { id: 'e', fromNode: 'a', toNode: 'c', fromSide: 'right', toSide: 'meio' },
        { id: 'f', fromNode: 'a', toNode: 'sumiu' },
        { id: 'g', fromNode: 'a', toNode: 'a' },
      ],
    });
    expect(c.nodes).toEqual([
      { id: 'a', type: 'text', x: 2, y: 0, width: 240, height: 120, text: 'oi' },
      { id: 'c', type: 'link', x: 0, y: 0, width: 40, height: 30, url: 'https://x.dev/a.png' },
    ]);
    expect(c.edges).toEqual([{ id: 'e', fromNode: 'a', toNode: 'c', fromSide: 'right' }]);
    expect(readCanvas(null)).toEqual({ nodes: [], edges: [] });
    expect(readCanvas([1])).toEqual({ nodes: [], edges: [] });
  });

  it('cartão de verdade pelo prefixo do link', () => {
    expect(cardRef(sample.nodes[2])).toEqual({ kind: 'note', id: NOTE });
    expect(cardRef(sample.nodes[3])).toEqual({ kind: 'task', id: TASK });
    expect(cardRef({ type: 'file', file: 'Receitas/bolo.md' })).toBeNull();
    expect(cardRef({ type: 'text', file: cardFile('note', NOTE) })).toBeNull();
  });

  it('mexe nos cartões e nas setas', () => {
    const at = placeNew(sample, { width: 100, height: 100 });
    expect(at).toEqual({ x: 1000, y: 0 });
    expect(placeNew({ nodes: [], edges: [] }, { width: 100, height: 100 })).toEqual({ x: 0, y: 0 });
    expect(placeNew(sample, { width: 100, height: 60 }, { x: 50, y: 50 })).toEqual({ x: 0, y: 20 });
    const grown = addNode(sample, { id: 'g2', type: 'group', x: 0, y: 0, width: 10, height: 10 });
    expect(grown.nodes[0].id).toBe('g2');
    expect(addNode(sample, { ...sample.nodes[1] })).toBe(sample);
    const moved = updateNode(sample, 'a', { x: 10, text: 'Outra' });
    expect(moved.nodes[1]).toMatchObject({ x: 10, text: 'Outra' });
    const linked = addEdge(sample, { id: 'e2', fromNode: 'n', toNode: 't' });
    expect(linked.edges).toHaveLength(2);
    expect(addEdge(linked, { id: 'e3', fromNode: 'n', toNode: 't' })).toBe(linked);
    expect(addEdge(linked, { id: 'e4', fromNode: 'n', toNode: 'n' })).toBe(linked);
    expect(updateEdge(linked, 'e1', { label: '' }).edges[0].label).toBeUndefined();
    expect(updateEdge(linked, 'e1', { color: '2' }).edges[0]).toMatchObject({
      label: 'vira',
      color: '2',
    });
    const less = removeNodes(linked, ['n']);
    expect(less.nodes.map((n) => n.id)).toEqual(['g', 'a', 't']);
    expect(less.edges).toEqual([]);
  });

  it('grupo do cartão', () => {
    expect(groupOf(sample, sample.nodes[1])?.label).toBe('Casa');
    expect(groupOf(sample, sample.nodes[3])).toBeNull();
  });

  it('exporta e importa', () => {
    const out = JSON.parse(
      exportCanvas(
        sample,
        (kind) => (kind === 'note' ? 'Plano: casa' : 'Pintar'),
        () => true,
      ),
    );
    expect(out.nodes[2]).toMatchObject({ type: 'file', file: 'Plano- casa.md' });
    expect(out.nodes[3]).toMatchObject({ type: 'text', text: '- [x] Pintar' });
    expect(out.nodes[3].file).toBeUndefined();
    const back = importCanvas(
      JSON.stringify(out),
      (title) => (title === 'Plano- casa' ? NOTE : null),
      'i-',
    )!;
    expect(back.nodes.map((n) => n.id)).toEqual(['i-g', 'i-a', 'i-n', 'i-t']);
    expect(cardRef(back.nodes[2])).toEqual({ kind: 'note', id: NOTE });
    expect(back.edges[0]).toMatchObject({ fromNode: 'i-a', toNode: 'i-n' });
    const other = importCanvas(
      JSON.stringify({
        nodes: [
          { id: 'x', type: 'file', x: 0, y: 0, width: 100, height: 50, file: 'pasta/foto.png' },
        ],
      }),
      () => null,
      'j-',
    )!;
    expect(other.nodes[0]).toMatchObject({ type: 'text', text: 'foto.png' });
    expect(importCanvas('nada', () => null, 'k-')).toBeNull();
    expect(importCanvas('{"a":1}', () => null, 'k-')).toBeNull();
    const merged = mergeCanvas(sample, back);
    expect(merged.nodes).toHaveLength(8);
    expect(merged.nodes[0].id).toBe('i-g');
    expect(Math.min(...merged.nodes.filter((n) => n.id.startsWith('i-')).map((n) => n.x))).toBe(
      1000,
    );
  });

  it('imagem pelo endereço', () => {
    expect(isImageUrl('https://x.dev/a.JPG?w=2')).toBe(true);
    expect(isImageUrl('https://x.dev/a')).toBe(false);
    expect(isImageUrl('javascript:alert(1).png')).toBe(false);
  });
});
