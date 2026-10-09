import { describe, expect, test } from '@jest/globals';

import { describeActivity } from '../activity';
import { initials, memberMatches, nameKey, resolveMention, toAssignees } from '../members';
import { projectProgress } from '../progress';

const ana = { userId: 'a', displayName: 'Ana Lima', aliases: [] };
const anaSouza = { userId: 'b', displayName: 'Ana Souza', aliases: [] };
const bia = { userId: 'c', displayName: 'Bia', aliases: ['Gregory'] };

describe('nameKey (mesmos casos do pgTAP fase4_projetos)', () => {
  test('sem acento, espaço nem maiúscula', () =>
    expect(nameKey('Grégory Silva')).toBe('gregorysilva'));
  test('tira o @', () => expect(nameKey('@cris')).toBe('cris'));
});

describe('memberMatches', () => {
  test.each([
    ['analima', true],
    ['Ana.Lima', true],
    ['ana', true],
    ['ÁNA', true],
    ['lima', false],
    ['', false],
  ])('@%s casa com "Ana Lima"? %s', (name, expected) =>
    expect(memberMatches(name, ana)).toBe(expected),
  );
  test('apelido reivindicado', () => expect(memberMatches('gregory', bia)).toBe(true));
});

describe('resolveMention', () => {
  test('um membro: atribui', () =>
    expect(resolveMention('bia', [ana, bia])).toEqual({
      kind: 'member',
      name: 'bia',
      userId: 'c',
    }));
  test('ninguém: pendente', () =>
    expect(resolveMention('cris', [ana, bia])).toEqual({ kind: 'pending', name: 'cris' }));
  test('mais de um: ambíguo, com os candidatos', () => {
    const r = resolveMention('ana', [ana, anaSouza, bia]);
    expect(r.kind).toBe('ambiguous');
    expect(r.kind === 'ambiguous' && r.candidates.map((c) => c.userId)).toEqual(['a', 'b']);
  });
  test('nome completo desfaz a ambiguidade', () =>
    expect(resolveMention('anasouza', [ana, anaSouza]).kind).toBe('member'));
});

describe('toAssignees', () => {
  test('sem repetir e sem os ambíguos', () => {
    expect(
      toAssignees([
        { kind: 'member', name: 'bia', userId: 'c' },
        { kind: 'member', name: 'gregory', userId: 'c' },
        { kind: 'pending', name: 'Cris' },
        { kind: 'pending', name: 'cris' },
        { kind: 'ambiguous', name: 'ana', candidates: [ana, anaSouza] },
      ]),
    ).toEqual([{ user_id: 'c' }, { pending_name: 'Cris' }]);
  });
});

test('initials', () => {
  expect(initials('Ana Lima')).toBe('AL');
  expect(initials('bia')).toBe('B');
  expect(initials(' ')).toBe('?');
});

describe('projectProgress', () => {
  const a = (task_id: string, user_id: string | null, pending_name: string | null) => ({
    task_id,
    user_id,
    pending_name,
  });
  test('geral, por pessoa e por nome pendente', () => {
    const p = projectProgress(
      [
        { id: '1', status: 'done' },
        { id: '2', status: 'todo' },
        { id: '3', status: 'done' },
      ],
      [a('1', 'u1', null), a('2', 'u1', null), a('3', null, 'Cris'), a('9', 'u1', null)],
    );
    expect(p.overall).toEqual({ done: 2, total: 3 });
    expect(p.byUser.get('u1')).toEqual({ done: 1, total: 2 });
    expect(p.byPending.get('cris')).toEqual({ done: 1, total: 1 });
  });
});

describe('describeActivity', () => {
  const actor = { display_name: 'Cris' };
  test.each([
    ['task_completed', { title: 'Comprar cerveja' }, 'Cris concluiu "Comprar cerveja"'],
    ['tasks_created', { count: 1, title: 'Gelo' }, 'Cris criou "Gelo"'],
    ['tasks_created', { count: 4 }, 'Cris criou 4 tarefas'],
    ['member_joined', {}, 'Cris entrou no projeto'],
    ['assignee_claimed', { name: 'cris' }, 'Cris vinculou @cris'],
  ])('%s', (action, payload, text) => {
    expect(describeActivity({ action, payload, actor })).toBe(text);
  });
});
