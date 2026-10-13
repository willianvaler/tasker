import type { Permission } from './permissions';

// Registro central de atalhos (ESCOPO_V2 §9). Toda tecla do app nasce aqui: a tabela da Ajuda e a
// paleta de comandos leem esta lista, nunca uma cópia à mão. As descrições são chaves do i18n.

/** Onde o atalho vale. `global`: qualquer tela logada; os outros, só com aquela área ativa. */
export type ShortcutScope = 'global' | 'list' | 'editor' | 'capture';

/**
 * Uma combinação: teclas separadas por "+", modificadores antes (`mod` = Ctrl, ou ⌘ no Mac).
 * Ex.: `mod+k`, `shift+f2`, `n`, `escape`.
 */
export type Combo = string;

export type Shortcut = {
  id: string;
  combos: readonly Combo[];
  description: `shortcuts.${string}`;
  scope: ShortcutScope;
  /** Sem a permissão, o atalho não faz nada (a ação mostra o aviso). */
  permission?: Permission;
};

export const SHORTCUTS = [
  {
    id: 'capture.open',
    combos: ['mod+k', 'n'],
    description: 'shortcuts.captureOpen',
    scope: 'global',
    permission: 'task.create',
  },
  {
    id: 'capture.close',
    combos: ['escape'],
    description: 'shortcuts.captureClose',
    scope: 'capture',
  },
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

export function findShortcut(id: ShortcutId): Shortcut {
  return SHORTCUTS.find((s) => s.id === id) as Shortcut;
}

/** O pedaço do KeyboardEvent que interessa (para testar sem DOM). */
export type KeyLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

const MODIFIERS = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const;

function parse(combo: Combo) {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  return { key, mods: new Set(parts) };
}

/**
 * A tecla bate com a combinação? Modificadores precisam ser exatamente os pedidos (`n` não dispara
 * com Ctrl+N). `mod` é ⌘ no Mac e Ctrl no resto.
 */
export function matchesCombo(combo: Combo, event: KeyLike, isMac: boolean): boolean {
  const { key, mods } = parse(combo);
  if (event.key.toLowerCase() !== key) return false;
  const wantCtrl = mods.has('ctrl') || (mods.has('mod') && !isMac);
  const wantMeta = mods.has('meta') || (mods.has('mod') && isMac);
  return (
    event.ctrlKey === wantCtrl &&
    event.metaKey === wantMeta &&
    event.altKey === mods.has('alt') &&
    // Shift só conta em letras e teclas nomeadas; em "?" o Shift já faz parte do caractere
    (key.length === 1 && !/[a-z0-9]/.test(key) ? true : event.shiftKey === mods.has('shift'))
  );
}

/**
 * Dentro de um campo de texto só valem os atalhos com Ctrl/⌘ e o Esc (V2 §9: atalho não pode
 * brigar com a digitação).
 */
export function allowedWhileTyping(combo: Combo): boolean {
  const { key, mods } = parse(combo);
  return mods.has('mod') || mods.has('ctrl') || mods.has('meta') || key === 'escape';
}

const KEY_LABELS: Record<string, string> = {
  escape: 'Esc',
  enter: 'Enter',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
  delete: 'Delete',
  backspace: 'Backspace',
};

/** Texto da combinação para a Ajuda: "⌘ K" no Mac, "Ctrl K" no resto. */
export function formatCombo(combo: Combo, isMac: boolean): string {
  const { key, mods } = parse(combo);
  const labels = MODIFIERS.filter((m) => mods.has(m)).map((m) => {
    if (m === 'mod') return isMac ? '⌘' : 'Ctrl';
    if (m === 'meta') return '⌘';
    if (m === 'alt') return isMac ? '⌥' : 'Alt';
    if (m === 'shift') return isMac ? '⇧' : 'Shift';
    return 'Ctrl';
  });
  return [...labels, KEY_LABELS[key] ?? key.toUpperCase()].join(' ');
}
