import { describe, expect, it } from '@jest/globals';

import { moveSibling } from '../move-sibling';

describe('moveSibling', () => {
  const abc = [
    { id: 'a', position: 1 },
    { id: 'b', position: 2 },
    { id: 'c', position: 3 },
  ];
  it('subir do meio: passa para antes do primeiro', () =>
    expect(moveSibling(abc, 'b', -1)).toBe(0));
  it('descer do meio: passa para depois do último', () => expect(moveSibling(abc, 'b', 1)).toBe(4));
  it('descer o primeiro: fica entre o segundo e o terceiro', () =>
    expect(moveSibling(abc, 'a', 1)).toBe(2.5));
  it('subir o último: fica entre o primeiro e o segundo', () =>
    expect(moveSibling(abc, 'c', -1)).toBe(1.5));
  it('primeiro subindo = null', () => expect(moveSibling(abc, 'a', -1)).toBeNull());
  it('último descendo = null', () => expect(moveSibling(abc, 'c', 1)).toBeNull());
  it('id desconhecido = null', () => expect(moveSibling(abc, 'x', 1)).toBeNull());
  it('lista com um item = null', () =>
    expect(moveSibling([{ id: 'a', position: 5 }], 'a', 1)).toBeNull());
  it('lista recebida fora de ordem', () =>
    expect(moveSibling([abc[2], abc[0], abc[1]], 'c', -1)).toBe(1.5));
  it('dois itens: o de baixo sobe para antes do de cima', () => {
    const position = moveSibling(abc.slice(0, 2), 'b', -1);
    expect(position).not.toBeNull();
    expect(position!).toBeLessThan(1);
  });
  it('empate: vale a ordem recebida', () =>
    expect(
      moveSibling(
        [
          { id: 'a', position: 1 },
          { id: 'b', position: 1 },
        ],
        'b',
        -1,
      ),
    ).toBe(0));
  it('não altera a lista recebida', () => {
    const list = [abc[2], abc[0], abc[1]];
    moveSibling(list, 'c', -1);
    expect(list.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });
});
