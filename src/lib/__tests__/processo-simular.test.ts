import { describe, expect, test } from '@jest/globals';

import { validar, type Grafo } from '@/lib/processo';
import { disporGrafo } from '@/lib/processo/layout';
import { MODELOS_PROCESSO } from '@/lib/processo/modelos';
import { simularProcesso } from '@/lib/processo/simular';

// PR5 (simulação sem efeito) e PR8 (os 4 modelos percorridos do início ao fim).

const modelo = (id: string) => MODELOS_PROCESSO.find((m) => m.id === id)!.grafo();

describe('simulação (PR5)', () => {
  test('percorre o caminho, mostra as variáveis e só descreve o webhook (nada sai)', () => {
    const g: Grafo = {
      v: 1,
      variaveis: [{ nome: 'valor', tipo: 'numero' }],
      nos: [
        { id: 'i', tipo: 'inicio' },
        {
          id: 'w',
          tipo: 'servico',
          acao: {
            tipo: 'enviar_webhook',
            url: 'https://exemplo.com/x',
            corpo: { v: '{{var.valor}}' },
          },
          entradas: { dobro: '{var.valor} * 2' },
        },
        { id: 'x', tipo: 'xor' },
        { id: 'alto', tipo: 'fim' },
        { id: 'baixo', tipo: 'fim' },
      ],
      arestas: [
        { id: '1', de: 'i', para: 'w' },
        { id: '2', de: 'w', para: 'x' },
        { id: '3', de: 'x', para: 'alto', condicao: '{var.dobro} > 100' },
        { id: '4', de: 'x', para: 'baixo', padrao: true },
      ],
    };
    const r = simularProcesso(g, { vars: { valor: 80 } });
    expect(r.fim).toBe('concluida');
    expect(r.passos.map((p) => p.no)).toEqual(['i', 'w', 'x', 'alto']);
    expect(r.passos[1]).toMatchObject({
      acao: { tipo: 'webhook', corpo: '{"v":"80"}' },
      vars: { valor: 80, dobro: 160 },
    });
  });

  test('a disposição automática dá posição a todo nó', () => {
    const g = disporGrafo(modelo('integracao'));
    for (const n of g.nos) expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
  });
});

describe('modelos internos (PR8)', () => {
  test.each(MODELOS_PROCESSO.map((m) => [m.id]))('%s é válido', (id) =>
    expect(validar(modelo(id))).toEqual([]),
  );

  test('revisão semanal: feita guarda o resumo; adiada volta no dia seguinte', () => {
    const g = modelo('revisao');
    const feita = simularProcesso(g, { formularios: { revisar: { resumo: 'Semana boa' } } });
    expect(feita.fim).toBe('concluida');
    expect(feita.passos.find((p) => p.no === 'anotar')?.acao).toMatchObject({
      corpo: 'Semana boa',
    });
    const adiada = simularProcesso(g, {
      escolhas: { revisar: 'Adiar' },
      formularios: { revisar: { resumo: 'x' } },
    });
    // Adiar volta para revisar (o laço da espera de 1 dia) até o limite da simulação
    expect(adiada.passos.filter((p) => p.no === 'adiada').length).toBeGreaterThan(1);
  });

  test('aprovação: aprovar, rejeitar e o prazo vencido seguem cada um o seu caminho', () => {
    const g = modelo('aprovacao');
    expect(simularProcesso(g).passos.map((p) => p.no)).toContain('ok');
    expect(
      simularProcesso(g, { escolhas: { aprovar: 'Rejeitar' } }).passos.map((p) => p.no),
    ).toContain('nao');
    expect(simularProcesso(g, { prazos: ['aprovar'] }).passos.map((p) => p.no)).toContain('tarde');
  });

  test('integração: as três tarefas e só depois o aviso', () => {
    const r = simularProcesso(modelo('integracao'));
    const ordem = r.passos.map((p) => p.no);
    expect(r.fim).toBe('concluida');
    for (const t of ['acessos', 'boas', 'apresentar'])
      expect(ordem.indexOf(t)).toBeLessThan(ordem.indexOf('avisa'));
    expect(ordem.filter((x) => x === 'avisa')).toHaveLength(1);
  });

  test('ciclo de estudo: três revisões com vencimento e o fim ao concluir (ou em 30 dias)', () => {
    const r = simularProcesso(modelo('estudo'), {
      inicio: { titulo: 'Cálculo', pagina: 'p1' },
      agora: '2026-11-25T12:00:00.000Z',
    });
    expect(r.fim).toBe('concluida');
    expect(
      r.passos.filter((p) => p.acao?.tipo === 'criar_tarefa').map((p) => p.acao?.vencimento),
    ).toEqual(['2026-11-26', '2026-11-28', '2026-12-02']);
  });
});
