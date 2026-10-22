// Barra de baixo do celular (D258): Hoje · [posição 2] · + · [posição 4] · Mais. As duas posições
// do meio são escolhidas pela pessoa (como no Todoist e no TickTick); o que não está na barra fica
// no Mais. O Material pede de 3 a 5 destinos; antes eram 6 abas e um "+" flutuante.

export type TabSlot = 'planejar' | 'inbox' | 'habits' | 'folders' | 'treino' | 'jogo' | 'pessoas';

/** Na ordem em que aparecem para escolher. */
export const TAB_SLOTS: readonly TabSlot[] = [
  'planejar',
  'inbox',
  'habits',
  'folders',
  'treino',
  'jogo',
  'pessoas',
];

export type TabContext = { gym: boolean; game: 'off' | 'light' | 'full' };

/** Opções que a conta tem: Treino só com o treino ligado; Jogo só com o jogo ligado. */
export function availableSlots(ctx: TabContext): TabSlot[] {
  return TAB_SLOTS.filter(
    (slot) => (slot !== 'treino' || ctx.gym) && (slot !== 'jogo' || ctx.game !== 'off'),
  );
}

/** Padrão sem escolha salva: quem treina vê o Treino; quem joga no RPG, o Jogo; os outros, o Planejar. */
export function defaultSlots(ctx: TabContext): [TabSlot, TabSlot] {
  return [ctx.gym ? 'treino' : ctx.game === 'full' ? 'jogo' : 'planejar', 'folders'];
}

/**
 * As duas posições do meio: as salvas (ui_prefs.tabs) quando valem para a conta; senão o padrão,
 * posição a posição, sem repetir.
 */
export function resolveSlots(saved: unknown, ctx: TabContext): [TabSlot, TabSlot] {
  const available = availableSlots(ctx);
  const valid = (value: unknown): value is TabSlot =>
    typeof value === 'string' && (available as string[]).includes(value);
  const fallback = defaultSlots(ctx);
  const list = Array.isArray(saved) ? saved : [];
  const first = valid(list[0]) ? list[0] : fallback[0];
  let second: TabSlot = valid(list[1]) ? list[1] : fallback[1];
  if (second === first) {
    second = [fallback[1], fallback[0], ...available].find((s) => s !== first) ?? 'folders';
  }
  return [first, second];
}

/** Rotas da barra, na ordem; o "+" entra entre as duas posições. */
export function barRoutes(slots: [TabSlot, TabSlot]) {
  return ['index', slots[0], slots[1], 'mais'] as const;
}
