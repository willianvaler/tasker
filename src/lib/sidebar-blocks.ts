// Ordem dos blocos da barra lateral (V6 §15.2). A ordem e os escondidos ficam no perfil
// (profiles.ui_prefs.sidebar); vêm do banco, então podem ter nomes desconhecidos ou repetidos.

export type SidebarBlock = 'notes' | 'gym' | 'folders' | 'projects' | 'received';

/** Academia logo acima de Projetos (V6 §15.1). */
export const DEFAULT_ORDER: readonly SidebarBlock[] = [
  'notes',
  'folders',
  'gym',
  'projects',
  'received',
];

export type SidebarPrefs = { order?: string[]; hidden?: string[] };

/**
 * Os blocos visíveis, na ordem: a salva primeiro (só os disponíveis, sem repetir); um bloco que a
 * ordem salva não tem (ex.: a Academia, ligada depois) entra logo depois do último já colocado que
 * vem antes dele na ordem padrão, ou no começo. Por fim saem os escondidos.
 */
export function resolveBlocks(
  prefs: SidebarPrefs | null | undefined,
  available: readonly SidebarBlock[],
): SidebarBlock[] {
  const isAvailable = (b: string): b is SidebarBlock => available.includes(b as SidebarBlock);
  const result: SidebarBlock[] = [];
  for (const b of prefs?.order ?? []) if (isAvailable(b) && !result.includes(b)) result.push(b);

  for (const block of DEFAULT_ORDER) {
    if (!available.includes(block) || result.includes(block)) continue;
    const before = DEFAULT_ORDER.slice(0, DEFAULT_ORDER.indexOf(block));
    const anchor = result.reduce((last, b, i) => (before.includes(b) ? i : last), -1);
    result.splice(anchor + 1, 0, block);
  }

  const hidden = new Set(prefs?.hidden ?? []);
  return result.filter((b) => !hidden.has(b));
}

/** Troca o bloco de lugar com o vizinho; nas pontas (ou ausente), uma cópia igual. */
export function moveBlock(
  order: readonly SidebarBlock[],
  block: SidebarBlock,
  dir: -1 | 1,
): SidebarBlock[] {
  const next = [...order];
  const from = next.indexOf(block);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= next.length) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Esconde ou mostra o bloco; `hidden` sem repetidos, na ordem padrão; `order` como veio. */
export function toggleHidden(
  prefs: SidebarPrefs | null | undefined,
  block: SidebarBlock,
): SidebarPrefs {
  const hidden = new Set(prefs?.hidden ?? []);
  if (hidden.has(block)) hidden.delete(block);
  else hidden.add(block);
  return {
    ...prefs,
    hidden: DEFAULT_ORDER.filter((b) => hidden.has(b)),
  };
}
