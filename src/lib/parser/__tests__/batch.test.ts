import { describe, expect, it } from '@jest/globals';

import { countBatch, looksLikeBatch, parseBatchInput } from '../batch';

// Quinta-feira, 8 de outubro de 2026
const today = '2026-10-08';
const parse = (text: string, mentions = false) => parseBatchInput(text, { today, mentions });
const titles = (text: string) => parse(text).map((i) => i.title);

// Casos da seção 8 do ESCOPO.md
describe('parseBatchInput: casos do escopo', () => {
  it('quebra de linha', () => expect(titles('a\nb\nc')).toEqual(['a', 'b', 'c']));
  it('ponto e vírgula', () => expect(titles('a; b; c')).toEqual(['a', 'b', 'c']));
  it('misturado', () => expect(titles('a; b\nc')).toEqual(['a', 'b', 'c']));
  it('marcador -', () => expect(titles('- a\n- b')).toEqual(['a', 'b']));
  it('numeração', () => expect(titles('1. a\n2. b')).toEqual(['a', 'b']));

  it('[x] e [ ]', () => {
    const items = parse('[x] a\n[ ] b');
    expect(items.map((i) => [i.title, i.done])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });

  it('recuo vira subtarefa', () => {
    const items = parse('a\n  b\n  c\nd');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('a');
    expect(items[0].children.map((c) => c.title)).toEqual(['b', 'c']);
    expect(items[1].title).toBe('d');
    expect(items[1].children).toEqual([]);
    expect(countBatch(items)).toBe(4);
  });

  it('responsáveis', () => {
    const items = parse('carne @gregory; cerveja @cris', true);
    expect(items.map((i) => [i.title, i.mentions])).toEqual([
      ['carne', ['gregory']],
      ['cerveja', ['cris']],
    ]);
  });

  it('lixo em volta', () => expect(titles('\n\n  ;; a ;; \n')).toEqual(['a']));

  it('data e prioridade', () => {
    const [item] = parse('reunião amanhã !!');
    expect(item).toMatchObject({ title: 'reunião', dueDate: '2026-10-09', priority: 2 });
  });

  it('aspas protegem o ;', () => expect(titles('"a;b"\nc')).toEqual(['a;b', 'c']));

  it('* é marcador, não recorrência', () => {
    const items = parse('* a\n* b');
    expect(items.map((i) => [i.title, i.recurrence])).toEqual([
      ['a', null],
      ['b', null],
    ]);
  });

  it('recorrência por dias', () => {
    const [item] = parse('academia /seg,qua,sex');
    expect(item).toMatchObject({
      title: 'academia',
      recurrence: { type: 'weekdays', days: [1, 3, 5] },
    });
  });
});

describe('parseBatchInput: bordas', () => {
  it('outros marcadores', () =>
    expect(titles('• a\n1) b\n– c\n- [x] d')).toEqual(['a', 'b', 'c', 'd']));
  it('[x] depois do marcador', () => expect(parse('- [x] d')[0].done).toBe(true));
  it('[X] maiúsculo', () => expect(parse('[X] a')[0].done).toBe(true));
  it('tab também é recuo', () =>
    expect(parse('a\n\tb')[0].children.map((c) => c.title)).toEqual(['b']));
  it('recuo sem item antes vira tarefa normal', () => expect(titles('  a\nb')).toEqual(['a', 'b']));
  it('linha recuada com ; vira várias subtarefas', () =>
    expect(parse('treino\n  supino; remada')[0].children.map((c) => c.title)).toEqual([
      'supino',
      'remada',
    ]));
  it('aspas curvas', () => expect(titles('“a;b”; c')).toEqual(['a;b', 'c']));
  it('aspas no meio ficam no título', () =>
    expect(titles('dizer "oi; tchau" pra ela')).toEqual(['dizer "oi; tchau" pra ela']));
  it('hífen colado não é marcador', () => expect(titles('-5 kg')).toEqual(['-5 kg']));
  it('CRLF do Windows', () => expect(titles('a\r\nb')).toEqual(['a', 'b']));
  it('vazio', () => expect(parse('  \n ; \n')).toEqual([]));
  it('guarda o texto original de cada item', () =>
    expect(parse('- carne #churrasco')[0].raw).toBe('carne #churrasco'));
  it('subtarefa marcada', () =>
    expect(parse('treino\n  [x] supino')[0].children[0].done).toBe(true));
});

describe('looksLikeBatch', () => {
  it('várias linhas', () => expect(looksLikeBatch('a\nb')).toBe(true));
  it('ponto e vírgula', () => expect(looksLikeBatch('a; b')).toBe(true));
  it('um item', () => expect(looksLikeBatch('comprar pão')).toBe(false));
  it('; dentro de aspas', () => expect(looksLikeBatch('"a;b"')).toBe(false));
  it('quebra só no fim', () => expect(looksLikeBatch('a\n')).toBe(false));
});
