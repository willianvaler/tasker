import { describe, expect, it } from '@jest/globals';

import { positionAfterMove } from '../positions';

describe('positionAfterMove', () => {
  const p = [1, 2, 3, 4];
  it('para baixo, no meio', () => expect(positionAfterMove(p, 0, 2)).toBe(3.5)); // fica entre 3 e 4
  it('para cima, no meio', () => expect(positionAfterMove(p, 3, 1)).toBe(1.5)); // entre 1 e 2
  it('para o topo', () => expect(positionAfterMove(p, 2, 0)).toBe(0));
  it('para o fim', () => expect(positionAfterMove(p, 0, 3)).toBe(5));
  it('mesmo lugar', () => expect(positionAfterMove(p, 1, 1)).toBe(2));
  it('lista de um', () => expect(positionAfterMove([7], 0, 0)).toBe(7));
});
