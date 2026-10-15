import type { Permission } from './permissions';

// Registro central de atalhos. Toda tecla do app nasce aqui: a tabela da Ajuda e a
// paleta de comandos leem esta lista, nunca uma cópia à mão. As descrições são chaves do i18n.

/** Onde o atalho vale. `global`: qualquer tela logada; os outros, só com aquela área ativa. */
export type ShortcutScope = 'global' | 'list' | 'editor' | 'capture' | 'menu' | 'workout';

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
    id: 'task.advanced',
    combos: ['mod+shift+n', 'alt+shift+n'],
    description: 'shortcuts.taskAdvanced',
    scope: 'global',
    permission: 'task.create',
  },
  { id: 'task.edit', combos: ['mod+e'], description: 'shortcuts.taskEdit', scope: 'list' },
  { id: 'form.save', combos: ['mod+enter'], description: 'shortcuts.formSave', scope: 'editor' },
  { id: 'help.open', combos: ['?'], description: 'shortcuts.helpOpen', scope: 'global' },
  {
    id: 'palette.open',
    combos: ['mod+k', '/'],
    description: 'shortcuts.paletteOpen',
    scope: 'global',
  },
  {
    id: 'capture.focus',
    combos: ['q', 'n'],
    description: 'shortcuts.captureFocus',
    scope: 'global',
    permission: 'task.create',
  },
  {
    id: 'capture.close',
    combos: ['escape'],
    description: 'shortcuts.captureClose',
    scope: 'capture',
  },
  {
    // Ctrl+N é reservado pelo navegador (nova janela): Alt+N funciona em qualquer lugar
    id: 'new.open',
    combos: ['mod+n', 'alt+n'],
    description: 'shortcuts.newOpen',
    scope: 'global',
  },
  { id: 'workout.done', combos: [' '], description: 'shortcuts.workoutDone', scope: 'workout' },
  {
    id: 'workout.skipRest',
    combos: ['r'],
    description: 'shortcuts.workoutSkipRest',
    scope: 'workout',
  },
  { id: 'new.task', combos: ['t'], description: 'shortcuts.newTask', scope: 'menu' },
  { id: 'new.page', combos: ['p'], description: 'shortcuts.newPage', scope: 'menu' },
  { id: 'new.folder', combos: ['f'], description: 'shortcuts.newFolder', scope: 'menu' },
  { id: 'new.project', combos: ['j'], description: 'shortcuts.newProject', scope: 'menu' },
  { id: 'new.habit', combos: ['h'], description: 'shortcuts.newHabit', scope: 'menu' },
  { id: 'list.next', combos: ['j', 'arrowdown'], description: 'shortcuts.listNext', scope: 'list' },
  { id: 'list.prev', combos: ['k', 'arrowup'], description: 'shortcuts.listPrev', scope: 'list' },
  { id: 'item.rename', combos: ['f2'], description: 'shortcuts.itemRename', scope: 'list' },
  { id: 'task.toggle', combos: [' ', 'x'], description: 'shortcuts.taskToggle', scope: 'list' },
  { id: 'task.priority1', combos: ['1'], description: 'shortcuts.taskPriority1', scope: 'list' },
  { id: 'task.priority2', combos: ['2'], description: 'shortcuts.taskPriority2', scope: 'list' },
  { id: 'task.priority3', combos: ['3'], description: 'shortcuts.taskPriority3', scope: 'list' },
  { id: 'task.date', combos: ['d'], description: 'shortcuts.taskDate', scope: 'list' },
  { id: 'task.assign', combos: ['a'], description: 'shortcuts.taskAssign', scope: 'list' },
  {
    id: 'task.moveUp',
    combos: ['mod+arrowup'],
    description: 'shortcuts.taskMoveUp',
    scope: 'list',
  },
  {
    id: 'task.moveDown',
    combos: ['mod+arrowdown'],
    description: 'shortcuts.taskMoveDown',
    scope: 'list',
  },
  {
    id: 'task.pomodoro',
    combos: ['p'],
    description: 'shortcuts.taskPomodoro',
    scope: 'list',
    permission: 'timer.use',
  },
  {
    id: 'task.start',
    combos: ['s'],
    description: 'shortcuts.taskStart',
    scope: 'list',
    permission: 'task.start',
  },
  {
    id: 'task.link',
    combos: ['l'],
    description: 'shortcuts.taskLink',
    scope: 'list',
    permission: 'dependency.manage',
  },
  { id: 'task.indent', combos: ['tab'], description: 'shortcuts.taskIndent', scope: 'list' },
  {
    id: 'task.outdent',
    combos: ['shift+tab'],
    description: 'shortcuts.taskOutdent',
    scope: 'list',
  },
  { id: 'tree.codes', combos: ['w'], description: 'shortcuts.treeCodes', scope: 'list' },
  { id: 'tree.expand', combos: ['arrowright'], description: 'shortcuts.treeExpand', scope: 'list' },
  {
    id: 'tree.collapse',
    combos: ['arrowleft'],
    description: 'shortcuts.treeCollapse',
    scope: 'list',
  },
  {
    id: 'task.delete',
    combos: ['delete', 'backspace'],
    description: 'shortcuts.taskDelete',
    scope: 'list',
  },
  {
    id: 'task.duplicate',
    combos: ['mod+d'],
    description: 'shortcuts.taskDuplicate',
    scope: 'list',
  },
  { id: 'app.undo', combos: ['mod+z'], description: 'shortcuts.appUndo', scope: 'global' },
  { id: 'app.sidebar', combos: ['mod+b'], description: 'shortcuts.appSidebar', scope: 'global' },
  { id: 'go.today', combos: ['g h'], description: 'shortcuts.goToday', scope: 'global' },
  { id: 'go.inbox', combos: ['g i'], description: 'shortcuts.goInbox', scope: 'global' },
  { id: 'go.mine', combos: ['g m'], description: 'shortcuts.goMine', scope: 'global' },
  { id: 'go.flow', combos: ['g f'], description: 'shortcuts.goFlow', scope: 'global' },
  {
    id: 'item.open',
    combos: ['shift+f2', 'enter'],
    description: 'shortcuts.itemOpen',
    scope: 'list',
  },
  { id: 'list.deselect', combos: ['escape'], description: 'shortcuts.listDeselect', scope: 'list' },
  {
    id: 'overlay.close',
    combos: ['escape'],
    description: 'shortcuts.overlayClose',
    scope: 'editor',
  },
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

export function findShortcut(id: ShortcutId): Shortcut {
  return SHORTCUTS.find((s) => s.id === id) as Shortcut;
}

/** O pedaço do KeyboardEvent que interessa (para testar sem DOM). */
export type KeyLike = {
  key: string;
  /** Tecla física ("KeyN"): no Mac, Option+N gera "˜" no `key` */
  code?: string;
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
  const physical =
    key.length === 1 && /[a-z]/.test(key) && event.code === `Key${key.toUpperCase()}`;
  if (event.key.toLowerCase() !== key && !(physical && (event.altKey || event.metaKey)))
    return false;
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
 * Dentro de um campo de texto só valem os atalhos com Ctrl/⌘ e o Esc (atalho não pode
 * brigar com a digitação).
 */
export function allowedWhileTyping(combo: Combo): boolean {
  const { key, mods } = parse(combo);
  return mods.has('mod') || mods.has('ctrl') || mods.has('meta') || key === 'escape';
}

const KEY_LABELS: Record<string, string> = {
  escape: 'Esc',
  tab: 'Tab',
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
