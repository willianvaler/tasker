// Quadro de contribuição (ESCOPO 4.6): destaques em tom amistoso, sem "último lugar".
// Mostra quem mais causou dano e, em ordem alfabética e sem números, quem também ajudou.

export type BoardEntry = { user_id: string; name: string; damage: number };

export function boardHighlights(entries: BoardEntry[]) {
  const contributors = entries.filter((e) => e.damage > 0);
  if (contributors.length === 0) return { top: [], helpers: [] as string[] };
  const best = Math.max(...contributors.map((e) => e.damage));
  // Empate no topo: todos são destaque
  const top = contributors.filter((e) => e.damage === best);
  const helpers = contributors
    .filter((e) => e.damage < best)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { top, helpers };
}
