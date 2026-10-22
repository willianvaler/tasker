import { describe, expect, it } from '@jest/globals';

import {
  availableSlots,
  barRoutes,
  defaultSlots,
  resolveSlots,
  tabUnderOverlay,
  type NavState,
} from '@/lib/tab-slots';

const base = { gym: false, game: 'light' as const };

describe('barra de baixo (D258)', () => {
  it('sem treino nem RPG: Planejar e Pastas', () => {
    expect(resolveSlots(undefined, base)).toEqual(['planejar', 'folders']);
  });

  it('quem treina começa com o Treino; quem joga no RPG, com o Jogo', () => {
    expect(defaultSlots({ gym: true, game: 'light' })).toEqual(['treino', 'folders']);
    expect(defaultSlots({ gym: false, game: 'full' })).toEqual(['jogo', 'folders']);
    expect(defaultSlots({ gym: true, game: 'full' })).toEqual(['treino', 'folders']);
  });

  it('usa a escolha salva', () => {
    expect(resolveSlots(['habits', 'inbox'], base)).toEqual(['habits', 'inbox']);
  });

  it('troca o que a conta não tem pelo padrão daquela posição', () => {
    // Treino desligado e jogo desligado
    expect(resolveSlots(['treino', 'jogo'], { gym: false, game: 'off' })).toEqual([
      'planejar',
      'folders',
    ]);
    expect(resolveSlots(['lixo', 42], base)).toEqual(['planejar', 'folders']);
  });

  it('não repete a mesma tela nas duas posições', () => {
    expect(resolveSlots(['folders', 'folders'], base)).toEqual(['folders', 'planejar']);
    expect(resolveSlots(['planejar', 'treino'], base)).toEqual(['planejar', 'folders']);
  });

  it('Treino e Jogo só aparecem para quem tem', () => {
    expect(availableSlots({ gym: false, game: 'off' })).not.toContain('treino');
    expect(availableSlots({ gym: false, game: 'off' })).not.toContain('jogo');
    expect(availableSlots({ gym: true, game: 'light' })).toEqual(
      expect.arrayContaining(['treino', 'jogo']),
    );
  });

  it('Hoje e Mais nas pontas', () => {
    expect(barRoutes(['planejar', 'folders'])).toEqual(['index', 'planejar', 'folders', 'mais']);
  });
});

describe('tabUnderOverlay', () => {
  const tabs = (name: string, index: number) => ({
    name: '(tabs)',
    state: { index, routes: [{ name: 'index' }, { name: name }] },
  });
  const root = (...routes: NavState['routes']): NavState => ({
    index: 0,
    routes: [{ name: '(app)', state: { index: routes.length - 1, routes } }],
  });

  it('painel da tarefa por cima da Hoje: a Hoje continua à vista', () => {
    expect(tabUnderOverlay(root(tabs('planejar', 0), { name: 'task/[id]' }))).toBe('index');
    expect(tabUnderOverlay(root(tabs('planejar', 1), { name: 'task/new' }))).toBe('planejar');
  });

  it('página aberta por cima cobre a aba', () => {
    expect(tabUnderOverlay(root(tabs('planejar', 0), { name: 'page/[id]' }))).toBeNull();
    expect(
      tabUnderOverlay(root(tabs('planejar', 0), { name: 'page/[id]' }, { name: 'task/[id]' })),
    ).toBeNull();
  });

  it('nada por cima, ou sem estado', () => {
    expect(tabUnderOverlay(root(tabs('planejar', 0)))).toBeNull();
    expect(tabUnderOverlay(undefined)).toBeNull();
    expect(tabUnderOverlay(root({ name: '(tabs)' }, { name: 'capture' }))).toBe('index');
  });
});
