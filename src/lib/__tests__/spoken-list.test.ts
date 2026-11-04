import { describe, expect, test } from '@jest/globals';

import { speechLang, spokenLines } from '../spoken-list';

describe('lista ditada (PB7)', () => {
  test('uma frase é uma linha, com maiúscula e sem ponto final', () => {
    expect(spokenLines('comprar pão amanhã.', 'pt-BR')).toEqual(['Comprar pão amanhã']);
  });

  test('"próximo item" e "nova tarefa" separam, com ou sem acento', () => {
    expect(
      spokenLines('carne próximo item carvão, nova tarefa gelo proximo item cerveja', 'pt-BR'),
    ).toEqual(['Carne', 'Carvão', 'Gelo', 'Cerveja']);
  });

  test('"próxima semana" e "depois de amanhã" continuam inteiros (são datas)', () => {
    expect(spokenLines('ligar para a Ana próxima semana', 'pt-BR')).toEqual([
      'Ligar para a Ana próxima semana',
    ]);
    expect(spokenLines('pagar a luz depois de amanhã', 'pt-BR')).toEqual([
      'Pagar a luz depois de amanhã',
    ]);
  });

  test('ponto e vírgula, ditado ou escrito pelo reconhecedor', () => {
    expect(spokenLines('ovos ponto e vírgula leite; café', 'pt-BR')).toEqual([
      'Ovos',
      'Leite',
      'Café',
    ]);
  });

  test('inglês e espanhol', () => {
    expect(spokenLines('milk next item eggs new task call mom next week', 'en')).toEqual([
      'Milk',
      'Eggs',
      'Call mom next week',
    ]);
    expect(spokenLines('leche siguiente tarea huevos', 'es')).toEqual(['Leche', 'Huevos']);
  });

  test('palavra que só contém o separador não separa', () => {
    expect(spokenLines('reler o capítulo novo', 'pt-BR')).toEqual(['Reler o capítulo novo']);
    expect(spokenLines('  ', 'pt-BR')).toEqual([]);
  });

  test('idioma do reconhecedor', () => {
    expect(speechLang('pt-BR')).toBe('pt-BR');
    expect(speechLang('en')).toBe('en-US');
    expect(speechLang('es')).toBe('es-ES');
  });
});

test('a prioridade digitada ou ditada como "!!" fica', () => {
  expect(spokenLines('café !!', 'pt-BR')).toEqual(['Café !!']);
});
