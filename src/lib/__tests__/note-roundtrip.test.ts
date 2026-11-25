import { describe, expect, test } from '@jest/globals';

import { exportVault, importVault } from '@/lib/vault';

import { gerarNotas } from './fixtures/notas-geradas';

// ED0/ED7 (ESCOPO_V16): ida e volta das anotações pelo cofre (exportar → importar). O editor grava o
// texto como foi digitado, então a ida e volta do editor é a identidade; e desde o ED7 (D347) a do
// cofre também: as 200 anotações voltam com o texto, as propriedades e os links iguais.

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
  const comIdNovo = (body: string) =>
    body.replace(/\|n:([0-9a-f-]{36})\]\]/g, (_, id: string) => `|n:${idNovo.get(id)}]]`);

  test('todas as 200 voltam, com título', () => {
    expect(back.notes).toHaveLength(200);
    for (const n of notas) expect(porTitulo.has(n.title)).toBe(true);
  });

  test('propriedades voltam iguais', () => {
    for (const n of notas) expect(porTitulo.get(n.title)?.props ?? {}).toEqual(n.props);
  });

  test('o texto volta igual, links (com o texto escrito, âncora e ID de bloco) inclusive', () => {
    for (const n of notas) expect(porTitulo.get(n.title)?.body).toBe(comIdNovo(n.body));
  });

  test('referência de bloco e transclusão voltam com o ^id', () => {
    const files2 = exportVault(
      [
        {
          id: 'a0000000-0000-4000-8000-000000000001',
          title: 'Origem',
          body: 'Bloco citado ^abc123',
          props: {},
          dir: ['Pasta'],
        },
        {
          id: 'a0000000-0000-4000-8000-000000000002',
          title: 'Cita',
          body: 'Ver [[Origem#^abc123|n:a0000000-0000-4000-8000-000000000001]]\n\n![[Origem#^abc123|n:a0000000-0000-4000-8000-000000000001]]',
          props: {},
          dir: [],
        },
      ],
      { untitled: 'S' },
    );
    expect(files2.find((f) => f.path === 'Cita.md')?.text).toBe(
      'Ver [[Origem#^abc123]]\n\n![[Origem#^abc123]]',
    );
    let j = 0;
    const back2 = importVault(files2, { newId: () => `b0000000-0000-4000-8000-00000000000${j++}` });
    const origem = back2.notes.find((n) => n.title === 'Origem');
    expect(back2.notes.find((n) => n.title === 'Cita')?.body).toBe(
      `Ver [[Origem#^abc123|n:${origem?.id}]]\n\n![[Origem#^abc123|n:${origem?.id}]]`,
    );
    expect(origem?.body).toBe('Bloco citado ^abc123');
  });
});
