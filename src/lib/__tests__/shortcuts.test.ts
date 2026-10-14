import { describe, expect, test } from '@jest/globals';

import ptBR from '@/i18n/locales/pt-BR.json';

import {
  allowedWhileTyping,
  formatCombo,
  matchesCombo,
  SHORTCUTS,
  type KeyLike,
} from '../shortcuts';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('matchesCombo', () => {
  test('mod é Ctrl fora do Mac e ⌘ no Mac', () => {
    expect(matchesCombo('mod+k', key('k', { ctrlKey: true }), false)).toBe(true);
    expect(matchesCombo('mod+k', key('k', { metaKey: true }), false)).toBe(false);
    expect(matchesCombo('mod+k', key('k', { metaKey: true }), true)).toBe(true);
    expect(matchesCombo('mod+k', key('K', { ctrlKey: true }), false)).toBe(true);
  });

  test('modificadores têm de ser exatamente os pedidos', () => {
    expect(matchesCombo('n', key('n'), false)).toBe(true);
    expect(matchesCombo('n', key('n', { ctrlKey: true }), false)).toBe(false);
    expect(matchesCombo('n', key('N', { shiftKey: true }), false)).toBe(false);
    expect(matchesCombo('mod+shift+n', key('N', { ctrlKey: true, shiftKey: true }), false)).toBe(
      true,
    );
    expect(matchesCombo('mod+n', key('n', { ctrlKey: true, shiftKey: true }), false)).toBe(false);
  });

  test('em símbolos como "?" o Shift faz parte do caractere', () => {
    expect(matchesCombo('?', key('?', { shiftKey: true }), false)).toBe(true);
  });

  test('teclas nomeadas', () => {
    expect(matchesCombo('escape', key('Escape'), false)).toBe(true);
    expect(matchesCombo('shift+f2', key('F2', { shiftKey: true }), false)).toBe(true);
    expect(matchesCombo('f2', key('F2', { shiftKey: true }), false)).toBe(false);
  });
});

test('digitando, só valem Ctrl/⌘ e Esc', () => {
  expect(allowedWhileTyping('mod+k')).toBe(true);
  expect(allowedWhileTyping('escape')).toBe(true);
  expect(allowedWhileTyping('n')).toBe(false);
  expect(allowedWhileTyping('shift+f2')).toBe(false);
});

test('formatCombo: ⌘ no Mac, Ctrl no resto', () => {
  expect(formatCombo('mod+k', true)).toBe('⌘ K');
  expect(formatCombo('mod+k', false)).toBe('Ctrl K');
  expect(formatCombo('mod+shift+n', true)).toBe('⌘ ⇧ N');
  expect(formatCombo('escape', false)).toBe('Esc');
  expect(formatCombo('arrowup', false)).toBe('↑');
});

describe('registro', () => {
  test('ids únicos', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a mesma tecla não aparece duas vezes no mesmo escopo', () => {
    const seen = new Set<string>();
    for (const s of SHORTCUTS)
      for (const combo of s.combos) {
        const id = `${s.scope}:${combo}`;
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
  });

  test('toda descrição existe no i18n', () => {
    const texts = ptBR.shortcuts as Record<string, string>;
    for (const s of SHORTCUTS) expect(texts[s.description.replace('shortcuts.', '')]).toBeTruthy();
  });
});

test('letra com Alt/⌘ vale pela tecla física (no Mac, Option+N gera "˜")', () => {
  expect(matchesCombo('alt+n', key('˜', { altKey: true, code: 'KeyN' }), true)).toBe(true);
  expect(matchesCombo('alt+n', key('˜', { altKey: true, code: 'KeyM' }), true)).toBe(false);
  // Sem modificador, vale o caractere (layouts diferentes do QWERTY)
  expect(matchesCombo('n', key('j', { code: 'KeyN' }), false)).toBe(false);
});
