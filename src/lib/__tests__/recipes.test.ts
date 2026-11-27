import { describe, expect, it } from '@jest/globals';

import {
  findFood,
  parseFoodsCsv,
  readRecipe,
  recipeMacros,
  recipesShopping,
  type Food,
} from '../recipes';
import { parseIngredient } from '../shopping';

const bolo = readRecipe({
  porções: 8,
  ingredientes: ['2 xícaras de farinha', '3 ovos', '200 g de açúcar', '1/2 l de leite'],
});
const panqueca = readRecipe({
  servings: '4',
  ingredients: ['1 xícara de farinha', '2 ovos', '0,5 kg açúcar', '300 ml leite', 'sal a gosto'],
});

describe('readRecipe', () => {
  it('lê as propriedades nos três idiomas, sem acento nem caixa', () => {
    expect(bolo).toEqual({
      servings: 8,
      ingredients: ['2 xícaras de farinha', '3 ovos', '200 g de açúcar', '1/2 l de leite'],
    });
    expect(panqueca?.servings).toBe(4);
    expect(readRecipe({ Porciones: 2, Ingredientes: 'arroz; feijão' })).toEqual({
      servings: 2,
      ingredients: ['arroz', 'feijão'],
    });
  });
  it('sem a propriedade de ingredientes não é receita', () => {
    expect(readRecipe({ porções: 2 })).toBeNull();
    expect(readRecipe(null)).toBeNull();
  });
});

describe('recipesShopping', () => {
  it('soma g com kg e mL com L; medida caseira fica como está; sem quantidade não soma', () => {
    if (!bolo || !panqueca) throw new Error('receita');
    const text = recipesShopping([{ recipe: bolo }, { recipe: panqueca }]);
    expect(text.split('\n')).toEqual([
      'Xícaras de farinha (2)',
      'Ovos (5)',
      'Açúcar (700 g)',
      'Leite (800 ml)',
      'Xícara de farinha (1)',
      'Sal a gosto',
    ]);
  });
  it('ajusta as quantidades pelas porções pedidas', () => {
    if (!panqueca) throw new Error('receita');
    // 4 porções → 8: tudo dobra
    expect(recipesShopping([{ recipe: panqueca, servings: 8 }]).split('\n')).toEqual([
      'Xícara de farinha (2)',
      'Ovos (4)',
      'Açúcar (1 kg)',
      'Leite (600 ml)',
      'Sal a gosto',
    ]);
  });
});

const foods: Food[] = [
  { id: '1', name: 'Ovo', basis: 'un', kcal: 70, protein: 6, carbs: 0.5, fat: 5 },
  { id: '2', name: 'Açúcar', basis: 'g', kcal: 400, protein: 0, carbs: 100, fat: 0 },
  { id: '3', name: 'Leite', basis: 'ml', kcal: 60, protein: 3.2, carbs: 4.8, fat: 3 },
  { id: '4', name: 'Farinha', basis: 'g', kcal: 360, protein: 10, carbs: 75, fat: 1 },
];

describe('recipeMacros', () => {
  it('só com a tabela da pessoa: o que não acha (ou a medida caseira) fica de fora e é listado', () => {
    if (!bolo) throw new Error('receita');
    const m = recipeMacros(bolo, foods);
    // 3 ovos (210) + 200 g de açúcar (800) + 500 ml de leite (300) = 1310 kcal; a farinha está em xícara
    expect(Math.round(m.total.kcal)).toBe(1310);
    expect(m.perServing && Math.round(m.perServing.kcal * 100) / 100).toBe(163.75);
    expect(m.missing).toEqual(['xícaras de farinha']);
    expect(m.counted).toBe(3);
  });
  it('plural acha o singular, e a base precisa combinar', () => {
    const ovos = parseIngredient('2 ovos');
    const leite = parseIngredient('200 g de leite');
    if (!ovos || !leite) throw new Error('ingrediente');
    expect(findFood(ovos, foods)?.name).toBe('Ovo');
    expect(findFood(leite, foods)).toBeUndefined();
  });
  it('sem porções, só o total', () => {
    expect(recipeMacros({ servings: null, ingredients: ['1 ovo'] }, foods).perServing).toBeNull();
  });
});

describe('parseFoodsCsv', () => {
  it('cabeçalho em português, separador ; e vírgula decimal', () => {
    const csv =
      'Nome;Base;Kcal;Proteína;Carboidrato;Gordura\nArroz;100g;128;2,5;28,1;0,2\nOvo;un;70;6;0,5;5\nRuim;xícara;1;1;1;1';
    expect(parseFoodsCsv(csv)).toEqual({
      foods: [
        { name: 'Arroz', basis: 'g', kcal: 128, protein: 2.5, carbs: 28.1, fat: 0.2 },
        { name: 'Ovo', basis: 'un', kcal: 70, protein: 6, carbs: 0.5, fat: 5 },
      ],
      skipped: 1,
    });
  });
  it('cabeçalho em inglês em outra ordem, e sem cabeçalho na ordem padrão', () => {
    expect(parseFoodsCsv('food,fat,kcal,protein,carbs,basis\nMilk,3,60,3.2,4.8,ml').foods).toEqual([
      { name: 'Milk', basis: 'ml', kcal: 60, protein: 3.2, carbs: 4.8, fat: 3 },
    ]);
    expect(parseFoodsCsv('Feijão;g;76;4,8;13,6;0,5').foods[0]).toMatchObject({
      name: 'Feijão',
      kcal: 76,
    });
  });
});
