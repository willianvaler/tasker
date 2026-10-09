import { describe, expect, test } from '@jest/globals';

import { describeActivity, describeClanActivity } from '../activity';
import { boardHighlights } from '../board';

const e = (name: string, damage: number) => ({ user_id: name, name, damage });

describe('boardHighlights', () => {
  test('destaque e quem ajudou, sem ordem de dano entre os outros', () => {
    const h = boardHighlights([e('Ana', 40), e('Caio', 5), e('Bia', 10)]);
    expect(h.top.map((t) => t.name)).toEqual(['Ana']);
    expect(h.helpers).toEqual(['Bia', 'Caio']);
  });
  test('empate no topo: os dois são destaque', () => {
    expect(boardHighlights([e('Ana', 10), e('Bia', 10)]).top).toHaveLength(2);
  });
  test('quem não causou dano não aparece', () => {
    expect(boardHighlights([e('Ana', 0)])).toEqual({ top: [], helpers: [] });
  });
});

describe('textos do feed', () => {
  test('clã', () => {
    expect(
      describeClanActivity({
        action: 'boss_defeated',
        payload: { name: 'Titã' },
        actor: { display_name: 'Bia' },
      }),
    ).toBe('⚔️ Bia deu o golpe final em Titã!');
    expect(
      describeClanActivity({
        action: 'achievement',
        payload: { name: 'Primeiro passo', icon: '🌱' },
        actor: { display_name: 'Ana' },
      }),
    ).toBe('🌱 Ana conquistou "Primeiro passo"');
  });
  test('boss de projeto', () => {
    expect(
      describeActivity({
        action: 'boss_started',
        payload: { name: 'Ogro', icon: '👹', deadline: '2026-10-17' },
        actor: { display_name: 'Ana' },
      }),
    ).toBe('Ana chamou 👹 Ogro para a briga (prazo 17/10)');
  });
});
