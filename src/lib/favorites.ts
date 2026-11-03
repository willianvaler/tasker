// Favoritos (OB12, ESCOPO_V11 §7, D297): anotações, listas e buscas no alto da barra lateral. Ficam
// nas preferências do perfil (`ui_prefs.favorites`), por pessoa: o `pinned` da anotação valeria para
// todo mundo numa anotação de projeto. Vêm do banco, então podem chegar com lixo. Funções puras.

export type Favorite =
  | { kind: 'note'; id: string }
  | { kind: 'page'; id: string }
  | { kind: 'search'; query: string };

export const MAX_FAVORITES = 50;

export const favoriteKey = (f: Favorite) =>
  f.kind === 'search' ? `search:${f.query.trim()}` : `${f.kind}:${f.id}`;

/** A lista guardada, só com o que tem forma de favorito e sem repetir */
export function readFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  const out: Favorite[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { kind, id, query } = item as Record<string, unknown>;
    let fav: Favorite | null = null;
    if ((kind === 'note' || kind === 'page') && typeof id === 'string' && id) fav = { kind, id };
    else if (kind === 'search' && typeof query === 'string' && query.trim())
      fav = { kind, query: query.trim().slice(0, 200) };
    if (!fav || seen.has(favoriteKey(fav))) continue;
    seen.add(favoriteKey(fav));
    out.push(fav);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

export const isFavorite = (list: readonly Favorite[], f: Favorite) =>
  list.some((x) => favoriteKey(x) === favoriteKey(f));

/** Põe no fim, ou tira se já estava */
export function toggleFavorite(list: readonly Favorite[], f: Favorite): Favorite[] {
  if (isFavorite(list, f)) return list.filter((x) => favoriteKey(x) !== favoriteKey(f));
  return [...list, f].slice(-MAX_FAVORITES);
}

/** Tira os que apontam para o que não existe mais (a anotação apagada, a lista que saiu) */
export function liveFavorites(
  list: readonly Favorite[],
  exists: (kind: 'note' | 'page', id: string) => boolean,
): Favorite[] {
  return list.filter((f) => f.kind === 'search' || exists(f.kind, f.id));
}
