import { describe, expect, test } from '@jest/globals';

import { exportVault, importVault } from '@/lib/vault';

import { gerarNotas } from './fixtures/notas-geradas';

// ED0 (ESCOPO_V16): ida e volta das anotações pelo cofre (exportar → importar). O editor grava o
// texto como foi digitado (é um campo de Markdown), então a ida e volta do editor é a identidade;
// o que pode perder é a exportação. Este teste fixa o que se perde hoje (docs/SPIKE_EDITOR.md).

describe('ida e volta pelo cofre (ED0)', () => {
  const notas = gerarNotas(200);
  const files = exportVault(
    notas.map((n) => ({ ...n, props: n.props as never, dir: [] })),
    { untitled: 'Sem título' },
  );
  let k = 0;
  const back = importVault(files, {
    newId: () => `10000000-0000-4000-8000-${String(k++).padStart(12, '0')}`,
  });
  const porTitulo = new Map(back.notes.map((n) => [n.title, n]));
  const idNovo = new Map(notas.map((n) => [n.id, porTitulo.get(n.title)?.id]));
  // Os links voltam com o id novo: troca o id antigo pelo novo para comparar
  const comIdNovo = (body: string) => body.replace(/\|n:([0-9a-f-]{36})\]\]/g, (_, id: string) => `|n:${idNovo.get(id)}]]`);

  test('todas as 200 voltam, com título', () => {
    expect(back.notes).toHaveLength(200);
    for (const n of notas) expect(porTitulo.has(n.title)).toBe(true);
  });

  test('propriedades voltam iguais', () => {
    for (const n of notas) expect(porTitulo.get(n.title)?.props ?? {}).toEqual(n.props);
  });

  test('o texto volta igual, a não ser nos links (o que se perde fica registrado)', () => {
    const iguais = notas.filter((n) => porTitulo.get(n.title)?.body === n.body).length;
    const semLinks = notas.filter((n) => !/\[\[[^\]]*\|n:/.test(n.body));
    // Sem links para outras anotações, o texto volta byte a byte
    for (const n of semLinks) expect(porTitulo.get(n.title)?.body).toBe(n.body);
    // Com links, o texto do link é trocado pelo nome do arquivo (o apelido fica depois do |)
    const comLinks = notas.filter((n) => /\[\[[^\]]*\|n:/.test(n.body));
    const perdas = comLinks.filter((n) => porTitulo.get(n.title)?.body !== comIdNovo(n.body));
    expect(iguais + comLinks.length).toBeGreaterThanOrEqual(semLinks.length);
    // Registro para o SPIKE_EDITOR.md: quantas mudam e um exemplo
    expect({ semLinks: semLinks.length, comLinks: comLinks.length, mudam: perdas.length }).toMatchSnapshot();
  });
});
