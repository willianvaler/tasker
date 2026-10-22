// Barra de baixo do celular (D258): Hoje · [posição 2] · + · [posição 4] · Mais. As duas posições
// do meio são escolhidas pela pessoa (como no Todoist e no TickTick); o que não está na barra fica
// no Mais. O Material pede de 3 a 5 destinos; antes eram 6 abas e um "+" flutuante.

export type TabSlot =
  'planejar' | 'inbox' | 'habits' | 'folders' | 'treino' | 'bem-estar' | 'jogo' | 'pessoas';

/** Na ordem em que aparecem para escolher. */
export const TAB_SLOTS: readonly TabSlot[] = [
  'planejar',
  'inbox',
  'habits',
  'folders',
  'treino',
  'bem-estar',
  'jogo',
  'pessoas',
];

export type TabContext = {
  gym: boolean;
  game: 'off' | 'light' | 'full';
  /** Academia dentro do Bem-estar (D270): o Treino não tem posição própria */
  gymInWellness?: boolean;
};

/**
 * Opções que a conta tem: Treino só com o treino ligado (e fora do Bem-estar); Jogo só com o jogo
 * ligado. O Bem-estar vale para todos (tem os remédios).
 */
export function availableSlots(ctx: TabContext): TabSlot[] {
  return TAB_SLOTS.filter(
    (slot) =>
      (slot !== 'treino' || (ctx.gym && !ctx.gymInWellness)) &&
      (slot !== 'jogo' || ctx.game !== 'off'),
  );
}

/**
 * Padrão sem escolha salva: quem treina vê o Treino (ou o Bem-estar, se a Academia mora nele); quem
 * joga no RPG, o Jogo; os outros, o Planejar.
 */
export function defaultSlots(ctx: TabContext): [TabSlot, TabSlot] {
  const gym: TabSlot = ctx.gymInWellness ? 'bem-estar' : 'treino';
  return [ctx.gym ? gym : ctx.game === 'full' ? 'jogo' : 'planejar', 'folders'];
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

/** Endereços das telas que mostram a barra de baixo no celular (o resto abre por cima dela). */
export const TAB_PATHS: readonly string[] = [
  '/',
  '/today',
  '/planejar',
  '/inbox',
  '/habits',
  '/folders',
  '/treino',
  '/bem-estar',
  '/jogo',
  '/pessoas',
  '/mine',
  '/mais',
];

export function isTabPath(pathname: string | null | undefined) {
  return TAB_PATHS.includes(pathname ?? '');
}

/** Telas que abrem por cima sem cobrir a de baixo (presentation: 'transparentModal' no layout). */
const OVERLAYS = new Set(['task/[id]', 'task/new', 'gasto/[id]', 'modos', 'capture']);

export type NavState = {
  index?: number;
  routes: { name: string; state?: NavState }[];
};

/**
 * A aba que aparece atrás de um painel transparente (o da tarefa, a captura), ou null se o que está
 * por cima cobre a tela (uma página aberta) ou não há nada por cima.
 */
export function tabUnderOverlay(state: NavState | undefined): string | null {
  let s = state;
  while (s) {
    const i = s.routes.findIndex((r) => r.name === '(tabs)');
    if (i >= 0) {
      const above = s.routes.slice(i + 1);
      if (!above.length || !above.every((r) => OVERLAYS.has(r.name))) return null;
      const tabs = s.routes[i].state;
      return tabs ? (tabs.routes[tabs.index ?? 0]?.name ?? null) : 'index';
    }
    s = s.routes[s.index ?? s.routes.length - 1]?.state;
  }
  return null;
}
