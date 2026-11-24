import { describe, expect, it } from '@jest/globals';
import { createInstance } from 'i18next';

import { pluralZeroAsOther } from '../plural';

function make(lng: string) {
  const i = createInstance();
  i.init({
    lng,
    initAsync: false,
    resources: {
      [lng]: {
        translation: {
          done_one: '{{count}} tarefa concluída',
          done_other: '{{count}} tarefas concluídas',
          lists_zero: 'Nenhuma lista',
          lists_one: '{{count}} lista',
          lists_other: '{{count}} listas',
        },
      },
    },
  });
  pluralZeroAsOther(i);
  // As chaves do app são tipadas; aqui o recurso é de teste
  return { t: i.t as unknown as (key: string, options: { count: number }) => string };
}

describe('pluralZeroAsOther', () => {
  it('em português, 0 vai para o plural', () => {
    const i = make('pt-BR');
    expect(i.t('done', { count: 0 })).toBe('0 tarefas concluídas');
    expect(i.t('done', { count: 1 })).toBe('1 tarefa concluída');
    expect(i.t('done', { count: 2 })).toBe('2 tarefas concluídas');
  });

  it('a chave _zero continua vencendo', () => {
    expect(make('pt-BR').t('lists', { count: 0 })).toBe('Nenhuma lista');
  });

  it('outros idiomas não mudam', () => {
    expect(make('en').t('done', { count: 1 })).toBe('1 tarefa concluída');
    expect(make('es').t('done', { count: 0 })).toBe('0 tarefas concluídas');
  });
});
