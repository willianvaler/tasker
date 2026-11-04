import { describe, expect, test } from '@jest/globals';

import { KITS, kitData, kitLanguage, type KitLanguage } from '../kits';

const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const LANGS: KitLanguage[] = ['pt-BR', 'en', 'es'];

describe('kits por assunto (PB6)', () => {
  test('os seis assuntos existem nos três idiomas, na mesma ordem', () => {
    for (const lang of LANGS)
      expect(KITS[lang].map((k) => k.key)).toEqual([
        'treino',
        'cardapio',
        'reforma',
        'viagem',
        'estudos',
        'evento',
      ]);
  });

  test('os idiomas têm as mesmas páginas, tipos e número de itens e dependências', () => {
    const shape = (lang: KitLanguage) =>
      KITS[lang].map((kit) => {
        const data = kitData(kit, '2026-11-04', counter());
        return {
          pages: data.pages.map((p) => [
            p.view_type,
            p.reset_cycle,
            p.items.length,
            !!p.budget_cents,
          ]),
          deps: data.deps,
        };
      });
    expect(shape('en')).toEqual(shape('pt-BR'));
    expect(shape('es')).toEqual(shape('pt-BR'));
  });

  test('reforma: cada etapa depende da anterior, sem "^" no título, e o orçamento vai junto', () => {
    const reforma = KITS['pt-BR'].find((k) => k.key === 'reforma');
    if (!reforma) throw new Error('sem reforma');
    const data = kitData(reforma, '2026-11-04', counter());
    const etapas = data.pages[0].items;
    expect(etapas).toHaveLength(10);
    expect(etapas[1].title).toBe('Pedir três orçamentos');
    expect(etapas.every((i) => !i.title.includes('^'))).toBe(true);
    expect(data.deps).toHaveLength(9);
    expect(data.deps[0]).toEqual({ task: etapas[1].id, on: etapas[0].id });
    expect(data.pages[1]).toMatchObject({
      view_type: 'expenses',
      budget_cents: 1500000,
      items: [],
    });
  });

  test('a numeração conta as subtarefas na ordem do texto', () => {
    const estudos = KITS['pt-BR'].find((k) => k.key === 'estudos');
    if (!estudos) throw new Error('sem estudos');
    const data = kitData(estudos, '2026-11-04', counter());
    const [m1, m2, simulado] = data.pages[0].items;
    expect(simulado.title).toBe('Simulado');
    expect(simulado.priority).toBe(2);
    const of = (id: string) => data.deps.filter((d) => d.task === id).map((d) => d.on);
    expect(of(simulado.id)).toEqual([m1.children[2].id, m2.children[2].id]);
    expect(of(m1.children[2].id)).toEqual([m1.children[0].id, m1.children[1].id]);
  });

  test('nenhum título perde palavra para a data (Segunda, Monday, Lunes) e nada nasce feito', () => {
    for (const lang of LANGS)
      for (const kit of KITS[lang]) {
        const data = kitData(kit, '2026-11-04', counter());
        const json = JSON.stringify(data);
        expect(json).not.toContain('due_date');
        for (const page of data.pages) for (const item of page.items) expect(item.done).toBe(false);
      }
    const menu = kitData(KITS['pt-BR'][1], '2026-11-04', counter()).pages[0].items;
    expect(menu[0].title).toBe('Segunda: frango grelhado com arroz');
    expect(menu[0].children.map((c) => c.title)).toContain('500 g de frango');
    const menuEn = kitData(KITS.en[1], '2026-11-04', counter()).pages[0].items;
    expect(menuEn[0].title).toBe('Monday: grilled chicken with rice');
  });

  test('idioma da interface', () => {
    expect(kitLanguage('en-US')).toBe('en');
    expect(kitLanguage('es')).toBe('es');
    expect(kitLanguage('pt-BR')).toBe('pt-BR');
    expect(kitLanguage(undefined)).toBe('pt-BR');
  });
});
