import { describe, expect, it } from '@jest/globals';

import { availableSlots, barRoutes, defaultSlots, resolveSlots } from '@/lib/tab-slots';

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
