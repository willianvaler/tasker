import { describe, expect, test } from '@jest/globals';

import {
  conferirRascunho,
  definicaoVazia,
  eventoExemplo,
  lerCondicoes,
  MODELOS,
  montarCondicoes,
  passoNovo,
  resumoGatilho,
} from '@/lib/automation/editor';
import { CATALOGO, registroBase, simulate } from '@/lib/automation/registry';

describe('editor de automações (AU7)', () => {
  test('condições: E/OU de itens com NÃO vai e volta', () => {
    const form = {
      modo: 'ou' as const,
      itens: [
        { pronta: 'dias_semana', dias: [1] },
        { campo: 'evento.titulo', op: 'contem', valor: 'x', nao: true },
      ],
    };
    const c = montarCondicoes(form);
    expect(c).toEqual({
      ou: [
        { pronta: 'dias_semana', dias: [1] },
        { nao: { campo: 'evento.titulo', op: 'contem', valor: 'x' } },
      ],
    });
    expect(lerCondicoes(c)).toEqual(form);
    expect(montarCondicoes({ modo: 'e', itens: [] })).toBeNull();
    expect(lerCondicoes(null)).toEqual({ modo: 'e', itens: [] });
  });

  test('condição aninhada fora do formulário fica só para ler', () => {
    expect(lerCondicoes({ e: [{ ou: [{ pronta: 'etiqueta', etiqueta: 'a' }] }] })).toBe('avancada');
  });

  test('todo passo novo é de um tipo do catálogo', () => {
    for (const id of Object.keys(CATALOGO.passos)) expect(passoNovo(id).tipo).toBe(id);
  });

  test('os modelos que já funcionam passam na conferência e rodam no Testar', () => {
    for (const m of MODELOS.filter((x) => !x.precisa)) {
      const { name, definition } = m.montar({ inbox: '00000000-0000-4000-8000-000000000009' });
      expect(conferirRascunho(name, definition)).toBeNull();
      const out = simulate(
        definition,
        {
          estado: {
            evento: eventoExemplo(definition.gatilho.tipo, {
              hoje: '2026-11-25',
              agora: '2026-11-25T22:00:00Z',
            }),
            var: {},
          },
          escopo: 'pessoal',
          regra: { id: 'r', nome: name },
          agora: '2026-11-25T22:00:00Z',
          fuso: 'America/Sao_Paulo',
          usuario: { nome: 'Ana', nivel: 3, atrasadas: 2 },
        },
        registroBase(),
      );
      expect(out.fim).toBe('ok');
    }
  });

  test('modelo das atrasadas avisa com a contagem', () => {
    const { definition } = MODELOS.find((m) => m.id === 'atrasadas')!.montar({});
    const out = simulate(
      definition,
      {
        estado: { evento: {}, var: {} },
        escopo: 'pessoal',
        regra: { id: 'r', nome: 'x' },
        agora: '2026-11-25T22:00:00Z',
        usuario: { atrasadas: 3 },
      },
      registroBase(),
    );
    expect(out.linhas.at(-1)?.efeito).toMatchObject({ corpo: 'Você tem 3 tarefas atrasadas.' });
  });

  test('os modelos de dispositivo esperam o Smart Life', () => {
    const { name, definition } = MODELOS.find((m) => m.id === 'ar')!.montar({});
    expect(conferirRascunho(name, definition)).toMatch(/Smart Life/);
  });

  test.each([
    [{ tipo: 'horario', hora: '22:30' }, 'Todo dia às 22:30'],
    [{ tipo: 'horario', hora: '07:00', dias: [1, 3] }, 'Seg, Qua às 07:00'],
    [{ tipo: 'intervalo', horas: 2 }, 'A cada 2 h'],
    [{ tipo: 'tarefa.vencendo', minutos: 30 }, 'Faltando 30 min para vencer'],
    [{ tipo: 'tarefa.concluida' }, 'Tarefa concluída'],
  ])('resumo %j', (g, out) => expect(resumoGatilho(g)).toBe(out));

  test.each([
    ['', definicaoVazia('pessoal'), /nome/],
    ['X', { ...definicaoVazia('pessoal'), passos: [] }, /passo/],
    ['X', { ...definicaoVazia('pessoal'), gatilho: { tipo: 'horario', hora: '25:00' } }, /HH:MM/],
    ['X', definicaoVazia('pessoal'), /título ou texto/],
  ])('conferência: %s', (name, def, erro) => expect(conferirRascunho(name, def)).toMatch(erro));
});
