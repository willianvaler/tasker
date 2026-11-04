import { describe, expect, test } from '@jest/globals';

import { publicBody } from '../published-note';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const inSet = (id: string) => id === A;

describe('publicBody (OB14)', () => {
  test('link para anotação do conjunto fica', () => {
    expect(publicBody(`ver [[Outra|n:${A}]]`, inSet)).toBe(`ver [[Outra|n:${A}]]`);
  });
  test('link para fora vira o texto escrito', () => {
    expect(publicBody(`ver [[Segredo|n:${B}]] e [[Tarefa|t:${A}]]`, inSet)).toBe(
      'ver Segredo e Tarefa',
    );
  });
  test('link para o que não existe vira o apelido ou o título com a seção', () => {
    expect(publicBody('[[Nova|ideia]] e [[Plano#Fim]]', inSet)).toBe('ideia e Plano › Fim');
  });
  test('incorporar vira link comum (ou texto)', () => {
    expect(publicBody(`![[Outra|n:${A}]]\n![[Foto.jpg]]`, inSet)).toBe(
      `[[Outra|n:${A}]]\nFoto.jpg`,
    );
  });
  test('consulta vira código', () => {
    expect(publicBody('```questlist\ntarefas de hoje\n```', inSet)).toBe(
      '```\ntarefas de hoje\n```',
    );
  });
  test('o texto do link perde a marcação do Markdown', () => {
    expect(publicBody(`[[a_b*c|n:${B}]]`, inSet)).toBe('a\\_b\\*c');
  });
});
