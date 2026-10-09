import { describe, expect, it } from '@jest/globals';

import { parseQuickInput } from '../quick';

// Quinta-feira, 8 de outubro de 2026
const today = '2026-10-08';
const parse = (text: string, mentions = false) => parseQuickInput(text, { today, mentions });

describe('prioridade', () => {
  it.each([
    ['a !', 1],
    ['a !!', 2],
    ['a !!!', 3],
    ['! a', 1],
  ])('%s', (text, priority) => expect(parse(text).priority).toBe(priority));
  it('! colado na palavra fica no título', () =>
    expect(parse('Ufa!')).toMatchObject({ title: 'Ufa!', priority: 0 }));
  it('!!!! não é prioridade', () => expect(parse('a !!!!').title).toBe('a !!!!'));
});

describe('datas', () => {
  it.each([
    ['hoje', '2026-10-08'],
    ['amanhã', '2026-10-09'],
    ['amanha', '2026-10-09'],
    ['depois de amanhã', '2026-10-10'],
    ['quinta', '2026-10-08'], // o próprio dia conta (D15)
    ['sexta', '2026-10-09'],
    ['sexta-feira', '2026-10-09'],
    ['sábado', '2026-10-10'],
    ['sabado', '2026-10-10'],
    ['domingo', '2026-10-11'],
    ['segunda', '2026-10-12'],
    ['terça', '2026-10-13'],
    ['quarta', '2026-10-14'],
    ['15/10', '2026-10-15'],
    ['5/1', '2027-01-05'], // já passou este ano
    ['8/10', '2026-10-08'],
    ['15/10/2027', '2027-10-15'],
    ['15/10/27', '2027-10-15'],
  ])('ligar %s', (word, date) => {
    expect(parse(`ligar ${word}`)).toMatchObject({ title: 'ligar', dueDate: date });
  });

  it('data no meio', () =>
    expect(parse('reunião amanhã cedo')).toMatchObject({
      title: 'reunião cedo',
      dueDate: '2026-10-09',
    }));
  it('preposição antes da data sai junto', () =>
    expect(parse('comprar presente para sexta')).toMatchObject({
      title: 'comprar presente',
      dueDate: '2026-10-09',
    }));
  it('"na", "no", "até"', () => {
    expect(parse('enviar na sexta').title).toBe('enviar');
    expect(parse('enviar no sábado').title).toBe('enviar');
    expect(parse('entregar até 15/10').title).toBe('entregar');
  });
  it('só a primeira data conta', () =>
    expect(parse('mover reunião de sexta para segunda')).toMatchObject({
      title: 'mover reunião de para segunda',
      dueDate: '2026-10-09',
    }));
  it('data inválida fica no título', () =>
    expect(parse('31/02 pagar')).toMatchObject({ title: '31/02 pagar', dueDate: null }));
  it('abreviações não são data', () =>
    expect(parse('ter reunião qua')).toMatchObject({ title: 'ter reunião qua', dueDate: null }));
  it('palavra que contém dia da semana', () => expect(parse('cesta básica').dueDate).toBeNull());
  it('maiúsculas', () => expect(parse('Ligar AMANHÃ').dueDate).toBe('2026-10-09'));
  it('virada de ano', () =>
    expect(parseQuickInput('a amanhã', { today: '2026-12-31' }).dueDate).toBe('2027-01-01'));
});

describe('etiquetas', () => {
  it('extrai e normaliza', () =>
    expect(parse('carne #Churrasco #mercado #churrasco')).toMatchObject({
      title: 'carne',
      labels: ['churrasco', 'mercado'],
    }));
  it('acentos', () => expect(parse('a #promoção').labels).toEqual(['promoção']));
  it('# sozinho fica', () => expect(parse('item # 2').title).toBe('item # 2'));
});

describe('responsáveis', () => {
  it('desligado: @ fica no título', () =>
    expect(parse('carne @gregory')).toMatchObject({ title: 'carne @gregory', mentions: [] }));
  it('ligado: extrai', () =>
    expect(parse('carne @gregory @cris', true)).toMatchObject({
      title: 'carne',
      mentions: ['gregory', 'cris'],
    }));
  it('e-mail não é menção', () =>
    expect(parse('mandar para ana@x.com', true).mentions).toEqual([]));
});

describe('recorrência', () => {
  it.each([
    ['/diaria', { type: 'daily' }],
    ['/diária', { type: 'daily' }],
    ['/semanal', { type: 'weekly' }],
    ['/mensal', { type: 'monthly' }],
    ['/sex,seg', { type: 'weekdays', days: [1, 5] }],
    ['/sáb,dom', { type: 'weekdays', days: [0, 6] }],
  ])('%s', (token, recurrence) =>
    expect(parse(`regar plantas ${token}`)).toMatchObject({ title: 'regar plantas', recurrence }),
  );
  it('barra comum fica', () =>
    expect(parse('ler e/ou escrever /').title).toBe('ler e/ou escrever /'));
  it('dia desconhecido fica', () => expect(parse('a /seg,xyz').title).toBe('a /seg,xyz'));
});

describe('título', () => {
  it('só sintaxe: mantém o texto como título', () =>
    expect(parse('amanhã')).toMatchObject({ title: 'amanhã', dueDate: null }));
  it('espaços extras', () => expect(parse('  comprar    pão  ').title).toBe('comprar pão'));
  it('tudo junto', () =>
    expect(parse('Pagar aluguel !!! #casa amanhã /mensal')).toEqual({
      title: 'Pagar aluguel',
      meta: null,
      priority: 3,
      dueDate: '2026-10-09',
      labels: ['casa'],
      mentions: [],
      recurrence: { type: 'monthly' },
    }));
});

describe('séries, repetições e carga (cards)', () => {
  const meta = (text: string) => parseQuickInput(text, { today, meta: true });
  it('4x12 e 20kg', () =>
    expect(meta('Supino 4x12 20kg')).toMatchObject({
      title: 'Supino',
      meta: { sets: 4, reps: 12, weight: '20kg' },
    }));
  it('carga com espaço e vírgula', () =>
    expect(meta('Rosca 3x10 12,5 kg').meta).toEqual({ sets: 3, reps: 10, weight: '12,5kg' }));
  it('X maiúsculo', () => expect(meta('Remada 4X8').meta).toEqual({ sets: 4, reps: 8 }));
  it('sem a opção, fica no título', () =>
    expect(parse('Supino 4x12 20kg')).toMatchObject({ title: 'Supino 4x12 20kg', meta: null }));
  it('número solto não é carga', () => expect(meta('Correr 5 km').title).toBe('Correr 5 km'));
});
