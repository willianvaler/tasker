import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_ORDER,
  moveBlock,
  resolveBlocks,
  toggleHidden,
  type SidebarBlock,
} from '../sidebar-blocks';

const all = DEFAULT_ORDER;
const noGym: SidebarBlock[] = ['notes', 'folders', 'projects', 'received'];

describe('resolveBlocks', () => {
  it('sem prefs: a ordem padrão, só os disponíveis', () => {
    expect(resolveBlocks(null, all)).toEqual(['notes', 'folders', 'gym', 'projects', 'received']);
    expect(resolveBlocks(undefined, noGym)).toEqual(noGym);
  });
  it('ordem salva com desconhecido e repetido', () =>
    expect(
      resolveBlocks(
        { order: ['projects', 'x', 'notes', 'projects', 'folders', 'received'] },
        noGym,
      ),
    ).toEqual(['projects', 'notes', 'folders', 'received']));
  it('bloco novo entra depois do último que vem antes dele na ordem padrão', () => {
    expect(
      resolveBlocks({ order: ['projects', 'notes', 'folders'] }, [
        'projects',
        'notes',
        'folders',
        'gym',
      ]),
    ).toEqual(['projects', 'notes', 'folders', 'gym']);
    expect(
      resolveBlocks({ order: ['notes', 'projects'] }, ['notes', 'projects', 'folders', 'gym']),
    ).toEqual(['notes', 'folders', 'gym', 'projects']);
  });
  it('bloco novo sem ninguém antes dele vai para o começo', () =>
    expect(resolveBlocks({ order: ['projects'] }, ['projects', 'notes'])).toEqual([
      'notes',
      'projects',
    ]));
  it('ordem salva com bloco indisponível (Academia desligada) é ignorada para ele', () =>
    expect(resolveBlocks({ order: ['gym', 'projects', 'notes'] }, noGym)).toEqual([
      'projects',
      'notes',
      'folders',
      'received',
    ]));
  it('tira os escondidos', () =>
    expect(resolveBlocks({ hidden: ['notes', 'received'] }, all)).toEqual([
      'folders',
      'gym',
      'projects',
    ]));
});

describe('moveBlock', () => {
  const order: SidebarBlock[] = ['notes', 'folders', 'gym'];
  it('no meio troca com o vizinho', () => {
    expect(moveBlock(order, 'folders', -1)).toEqual(['folders', 'notes', 'gym']);
    expect(moveBlock(order, 'folders', 1)).toEqual(['notes', 'gym', 'folders']);
  });
  it('nas pontas e ausente: cópia igual', () => {
    expect(moveBlock(order, 'notes', -1)).toEqual(order);
    expect(moveBlock(order, 'gym', 1)).toEqual(order);
    expect(moveBlock(order, 'received', 1)).toEqual(order);
    expect(moveBlock(order, 'notes', -1)).not.toBe(order);
  });
  it('não muda a lista recebida', () => {
    moveBlock(order, 'gym', -1);
    expect(order).toEqual(['notes', 'folders', 'gym']);
  });
});

describe('toggleHidden', () => {
  it('esconde e mostra de novo, sem repetir, na ordem padrão', () => {
    const prefs = { order: ['projects', 'notes'], hidden: ['received'] };
    const hidden = toggleHidden(prefs, 'notes');
    expect(hidden).toEqual({ order: ['projects', 'notes'], hidden: ['notes', 'received'] });
    expect(toggleHidden(hidden, 'notes')).toEqual({
      order: ['projects', 'notes'],
      hidden: ['received'],
    });
    expect(prefs).toEqual({ order: ['projects', 'notes'], hidden: ['received'] });
  });
  it('sem prefs', () => expect(toggleHidden(null, 'gym')).toEqual({ hidden: ['gym'] }));
});
