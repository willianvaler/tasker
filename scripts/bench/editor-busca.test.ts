import { expect, test } from '@jest/globals';

import { fold } from '@/lib/query/parse';
import { foldedText, matchSearch, parseSearch, searchRank, type SearchItem } from '@/lib/search';

import { gerarNotas } from '../../src/lib/__tests__/fixtures/notas-geradas';

// Bancada do ED5 (ESCOPO_V16): buscar em 100 mil anotações com a busca da paleta (lib/search.ts),
// que roda no aparelho sobre a lista em memória. npm run bench:editor (fora do npm test).

declare const console: { log: (...a: unknown[]) => void };

test('busca em 100 mil anotações', () => {
  const base = gerarNotas(1000, 1);
  const itens: SearchItem[] = Array.from({ length: 100_000 }, (_, i) => {
    const n = base[i % base.length];
    return {
      kind: 'note',
      title: `${n.title} ${i}`,
      text: n.body,
      tags: (n.props.tags as string[]) ?? [],
    };
  });
  const tempos: Record<string, number> = {};
  for (const busca of [
    'mercado',
    'reunião casa',
    '"projeto ideia"',
    'tag:casa estudo',
    'xyzinexistente',
  ]) {
    const q = parseSearch(busca);
    const t0 = performance.now();
    const achou = itens.filter((it) => matchSearch(q, it));
    achou.sort((a, b) => searchRank(q, a) - searchRank(q, b));
    tempos[busca] = Math.round(performance.now() - t0);
  }
  console.log('BUSCA_100K_MS', JSON.stringify(tempos));
  // O caminho da correção: o texto sem acento guardado (calculado uma vez por versão da anotação)
  const t1 = performance.now();
  const dobrado = itens.map((it) => fold(`${it.title}\n${it.text ?? ''}`));
  const preparo = Math.round(performance.now() - t1);
  const cache: Record<string, number> = {};
  for (const busca of ['mercado', 'reunião casa', 'xyzinexistente']) {
    const palavras = parseSearch(busca).words;
    const t0 = performance.now();
    dobrado.filter((h) => palavras.every((w) => h.includes(w)));
    cache[busca] = Math.round(performance.now() - t0);
  }
  console.log('BUSCA_100K_CACHE_MS', JSON.stringify({ preparo, ...cache }));
  // O caminho da paleta (D346): foldedText guarda por versão; a primeira busca prepara, as outras não
  const comCache = itens.map((it, i) => ({
    ...it,
    folded: foldedText(`n${i}:v1`, it.title, it.text),
  }));
  const paleta: Record<string, number> = {};
  for (const busca of [
    'mercado',
    'reunião casa',
    '"projeto ideia"',
    'tag:casa estudo',
    'xyzinexistente',
  ]) {
    const q = parseSearch(busca);
    const t0 = performance.now();
    // Como a paleta: a cada busca, uma consulta ao cache por item (o texto já está pronto)
    const achou = comCache
      .map((it, i) => {
        const item = {
          kind: it.kind,
          title: it.title,
          text: it.text,
          tags: it.tags,
          folded: foldedText(`n${i}:v1`, '', ''),
        };
        return { item, ok: matchSearch(q, item), rank: 0 };
      })
      .filter((x) => x.ok)
      .map((x) => ({ ...x, rank: searchRank(q, x.item) }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10);
    expect(achou.length).toBeLessThanOrEqual(10);
    paleta[busca] = Math.round(performance.now() - t0);
  }
  console.log('BUSCA_100K_PALETA_MS', JSON.stringify(paleta));
  expect(Object.keys(tempos)).toHaveLength(5);
});
