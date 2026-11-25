import { describe, expect, test } from '@jest/globals';

import {
  avancar,
  ehFuncaoPura,
  rodarPura,
  executarToken,
  aposEspera,
  duracaoMin,
  exprApi,
  saidasDoNo,
  textoDoErro,
  validar,
  type Grafo,
  type TokenReivindicado,
} from '@/lib/processo';
import { registroBase } from '@/lib/automation/registry';

// ESCOPO_V16 (PR2, PR3, PR4): validação do grafo e o passo do motor, puros.

const g = (nos: Grafo['nos'], arestas: Grafo['arestas'], extra: Partial<Grafo> = {}): Grafo => ({
  v: 1,
  nos,
  arestas,
  ...extra,
});
const ok = g(
  [
    { id: 'i', tipo: 'inicio' },
    { id: 'f', tipo: 'fim' },
  ],
  [{ id: 'a', de: 'i', para: 'f' }],
);
const codigos = (x: Grafo) => validar(x).map((e) => `${e.codigo}:${e.no ?? e.aresta ?? ''}`);

describe('validação (PR2)', () => {
  test('o mínimo passa', () => expect(validar(ok)).toEqual([]));

  test.each([
    [
      'dois inícios',
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 'j', tipo: 'inicio' },
          { id: 'f', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 'f' },
          { id: 'b', de: 'j', para: 'f' },
        ],
      ),
      'dois_inicios:j',
    ],
    [
      'nó inalcançável',
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 's', tipo: 'servico', acao: { tipo: 'notificar' } },
          { id: 'f', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 'f' },
          { id: 'b', de: 's', para: 'f' },
        ],
      ),
      'inalcancavel:s',
    ],
    [
      'XOR sem padrão',
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 'x', tipo: 'xor' },
          { id: 'f', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 'x' },
          { id: 'b', de: 'x', para: 'f', condicao: '1' },
          { id: 'c', de: 'x', para: 'f', condicao: '0' },
        ],
      ),
      'xor_sem_padrao:x',
    ],
    [
      'paralelo sem junção',
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 'p', tipo: 'and' },
          { id: 'f', tipo: 'fim' },
          { id: 'f2', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 'p' },
          { id: 'b', de: 'p', para: 'f' },
          { id: 'c', de: 'p', para: 'f2' },
        ],
      ),
      'and_sem_juncao:p',
    ],
    [
      'laço sem saída',
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 's', tipo: 'servico', acao: { tipo: 'notificar' } },
          { id: 'f', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 's' },
          { id: 'b', de: 's', para: 's' },
          { id: 'c', de: 'i', para: 'f' },
        ],
      ),
      'sem_saida:s',
    ],
  ])('%s é recusado apontando o nó', (_n, grafo, esperado) =>
    expect(codigos(grafo)).toContain(esperado),
  );

  test('mais de 200 nós é recusado', () => {
    const nos = [
      { id: 'i', tipo: 'inicio' as const },
      ...Array.from({ length: 200 }, (_, k) => ({ id: `f${k}`, tipo: 'fim' as const })),
    ];
    expect(
      codigos(
        g(
          nos,
          nos.slice(1).map((n) => ({ id: `a${n.id}`, de: 'i', para: n.id })),
        ),
      ),
    ).toContain('muitos_nos:');
  });

  test('paralelo balanceado passa', () => {
    const par = g(
      [
        { id: 'i', tipo: 'inicio' },
        { id: 'p', tipo: 'and' },
        { id: 'a1', tipo: 'servico', acao: { tipo: 'notificar' } },
        { id: 'a2', tipo: 'servico', acao: { tipo: 'notificar' } },
        { id: 'j', tipo: 'and' },
        { id: 'f', tipo: 'fim' },
      ],
      [
        { id: 'e1', de: 'i', para: 'p' },
        { id: 'e2', de: 'p', para: 'a1' },
        { id: 'e3', de: 'p', para: 'a2' },
        { id: 'e4', de: 'a1', para: 'j' },
        { id: 'e5', de: 'a2', para: 'j' },
        { id: 'e6', de: 'j', para: 'f' },
      ],
    );
    expect(validar(par)).toEqual([]);
  });

  test('variável não declarada falha (PR3); declarada passa', () => {
    const usa = (variaveis: Grafo['variaveis']) =>
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 'x', tipo: 'xor' },
          { id: 'f', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 'x' },
          { id: 'b', de: 'x', para: 'f', condicao: '{var.valor} > 100' },
          { id: 'c', de: 'x', para: 'f', padrao: true },
        ],
        { variaveis },
      );
    expect(codigos(usa([]))).toContain('variavel_nao_declarada:b');
    expect(validar(usa([{ nome: 'valor', tipo: 'numero' }]))).toEqual([]);
  });

  test('mensagem clara com o nome do nó', () => {
    const e = validar(
      g(
        [
          { id: 'i', tipo: 'inicio' },
          { id: 'x', tipo: 'xor', nome: 'Aprovou?' },
          { id: 'f', tipo: 'fim' },
        ],
        [
          { id: 'a', de: 'i', para: 'x' },
          { id: 'b', de: 'x', para: 'f', condicao: '1' },
        ],
      ),
    ).find((x) => x.codigo === 'xor_sem_padrao');
    expect(textoDoErro(e!, new Map([['x', 'Aprovou?']]))).toBe(
      'Decisão "Aprovou?" precisa de um caminho padrão (e só um).',
    );
  });

  test.each([
    ['PT2H', 120],
    ['P1DT30M', 1470],
    ['PT48H', 2880],
    ['2 horas', null],
  ])('duração %s → %s min', (d, m) => expect(duracaoMin(d)).toBe(m));
});

describe('passo do motor (PR3, PR4)', () => {
  const c = {
    vars: { valor: 150 },
    inicio: { titulo: 'Compra' },
    hoje: '2026-11-25',
    agora: '2026-11-25T12:00:00.000Z',
  };

  test('XOR segue a primeira condição verdadeira, senão o padrão', () => {
    const x = g(
      [
        { id: 'i', tipo: 'inicio' },
        { id: 'x', tipo: 'xor' },
        { id: 'alto', tipo: 'fim' },
        { id: 'baixo', tipo: 'fim' },
      ],
      [
        { id: 'a', de: 'i', para: 'x' },
        { id: 'b', de: 'x', para: 'alto', condicao: '{var.valor} > 100' },
        { id: 'c', de: 'x', para: 'baixo', padrao: true },
      ],
    );
    expect(avancar(x, 'x', {}, c, exprApi)).toMatchObject({
      tipo: 'seguir',
      proximos: [{ no: 'alto' }],
    });
    expect(avancar(x, 'x', {}, { ...c, vars: { valor: 5 } }, exprApi)).toMatchObject({
      proximos: [{ no: 'baixo' }],
    });
  });

  test('paralelo divide em três e a junção espera os três', () => {
    const p = g(
      [
        { id: 'p', tipo: 'and' },
        { id: 'a', tipo: 'fim' },
        { id: 'b', tipo: 'fim' },
        { id: 'c', tipo: 'fim' },
        { id: 'j', tipo: 'and' },
      ],
      [
        { id: '1', de: 'p', para: 'a' },
        { id: '2', de: 'p', para: 'b' },
        { id: '3', de: 'p', para: 'c' },
        { id: '4', de: 'a', para: 'j' },
        { id: '5', de: 'b', para: 'j' },
        { id: '6', de: 'c', para: 'j' },
      ],
    );
    expect(avancar(p, 'p', {}, c, exprApi)).toMatchObject({
      tipo: 'seguir',
      proximos: [{ no: 'a' }, { no: 'b' }, { no: 'c' }],
    });
    expect(avancar(p, 'j', {}, c, exprApi)).toMatchObject({ tipo: 'juntar', esperados: 3 });
  });

  test('laço repete até a condição ou o máximo', () => {
    const l = g(
      [
        { id: 'l', tipo: 'laco', max: 3, condicao: '{var.feito}' },
        { id: 'f', tipo: 'fim' },
        { id: 's', tipo: 'fim' },
      ],
      [
        { id: 'r', de: 'l', para: 'f', laco: 'repetir' },
        { id: 's1', de: 'l', para: 's', laco: 'sair' },
      ],
    );
    let esc = {};
    const caminhos: string[] = [];
    for (let k = 0; k < 5; k++) {
      const d = avancar(l, 'l', esc, { ...c, vars: { feito: false } }, exprApi);
      if (d.tipo !== 'seguir') throw new Error();
      caminhos.push(d.proximos[0].no);
      esc = d.proximos[0].escopo ?? {};
      if (d.proximos[0].no === 's') break;
    }
    expect(caminhos).toEqual(['f', 'f', 'f', 's']);
  });

  test('tarefa humana espera, com prazo e lembrete; depois segue pela escolha', () => {
    const h = g(
      [
        {
          id: 'h',
          tipo: 'humana',
          titulo: 'Aprovar {var.valor}',
          prazo: 'PT48H',
          lembrete_h: 24,
          escolhas: ['Aprovar', 'Rejeitar'],
        },
        { id: 'ok', tipo: 'fim' },
        { id: 'nao', tipo: 'fim' },
        { id: 'tarde', tipo: 'fim' },
      ],
      [
        { id: '1', de: 'h', para: 'ok', escolha: 'Aprovar' },
        { id: '2', de: 'h', para: 'nao', escolha: 'Rejeitar' },
        { id: '3', de: 'h', para: 'tarde', prazo: true },
      ],
    );
    const d = avancar(h, 'h', {}, c, exprApi);
    expect(d).toMatchObject({
      tipo: 'esperar',
      espera: {
        tipo: 'humana',
        ate: '2026-11-27T12:00:00.000Z',
        lembrete: '2026-11-26T12:00:00.000Z',
      },
    });
    expect(aposEspera(h, 'h', {}, { escolha: 'Rejeitar' })).toEqual([{ no: 'nao', escopo: {} }]);
    expect(aposEspera(h, 'h', {}, { prazo: true })).toEqual([{ no: 'tarde', escopo: {} }]);
  });

  test('formulário e saídas viram variáveis', () => {
    const h = g(
      [{ id: 'h', tipo: 'humana', titulo: 'x', saidas: { total: '{retorno.formulario.qtd} * 2' } }],
      [],
    );
    expect(
      saidasDoNo(h, 'h', { ...c, retorno: { formulario: { qtd: 3, obs: 'ok' } } }, exprApi),
    ).toEqual({ qtd: 3, obs: 'ok', total: 6 });
  });

  test('expressão acima de 1.000 operações falha o passo (PR3)', () => {
    const grande = Array.from({ length: 600 }, () => '1').join(' + ');
    const x = g(
      [
        { id: 'x', tipo: 'xor' },
        { id: 'f', tipo: 'fim' },
      ],
      [
        {
          id: 'b',
          de: 'x',
          para: 'f',
          condicao: `max(${Array.from({ length: 20 }, () => `(${grande.slice(0, 450)})`).join(',')}) > 0`,
        },
        { id: 'c', de: 'x', para: 'f', padrao: true },
      ],
    );
    const d = avancar(x, 'x', {}, c, exprApi);
    expect(d).toMatchObject({ tipo: 'falha' });
    expect((d as { erro: string }).erro).toMatch(/budget|tooLong/);
  });

  test('tarefa de serviço devolve a ação do registro do V14 com as entradas', () => {
    const s = g(
      [
        {
          id: 's',
          tipo: 'servico',
          acao: { tipo: 'notificar', corpo: 'Oi {{var.nome}}' },
          entradas: { nome: '{inicio.titulo}' },
        },
        { id: 'f', tipo: 'fim' },
      ],
      [{ id: 'a', de: 's', para: 'f' }],
    );
    expect(avancar(s, 's', {}, c, exprApi)).toEqual({
      tipo: 'seguir',
      proximos: [{ no: 'f', escopo: {} }],
      vars: { nome: 'Compra' },
      efeito: { tipo: 'notificar', corpo: 'Oi {{var.nome}}' },
    });
  });
});

describe('executor de token (PR4)', () => {
  const grafo = g(
    [
      { id: 'i', tipo: 'inicio' },
      {
        id: 'w',
        tipo: 'servico',
        acao: {
          tipo: 'enviar_webhook',
          url: 'https://exemplo.com/h',
          corpo: { cliente: '{{var.cliente}}' },
        },
      },
      { id: 'n', tipo: 'servico', acao: { tipo: 'notificar', corpo: 'Oi {{var.cliente}}' } },
      { id: 'h', tipo: 'humana', titulo: 'Conferir {{var.cliente}}' },
      { id: 'f', tipo: 'fim' },
    ],
    [
      { id: '1', de: 'i', para: 'w' },
      { id: '2', de: 'w', para: 'n' },
      { id: '3', de: 'n', para: 'h' },
      { id: '4', de: 'h', para: 'f' },
    ],
  );
  const token = (node: string, extra: Partial<TokenReivindicado> = {}): TokenReivindicado => ({
    token: 't1',
    claimed_at: '2026-11-25T12:00:00Z',
    node,
    scope: {},
    result: null,
    retries: 0,
    instance: 'inst1',
    vars: { cliente: 'Ana' },
    start: {},
    graph: grafo,
    definition: 'def1',
    name: 'Teste',
    ...extra,
  });
  const reg = registroBase();
  const base = (commits: unknown[], recebidos: Set<string>, entregas: { n: number }) => ({
    expr: exprApi,
    passo: (tipo: string) => reg.get(tipo) as never,
    externo: async (efeito: Record<string, unknown>, chave: string) => {
      entregas.n++;
      // O destino descarta o que já recebeu com a mesma chave (X-Questlist-Idempotency)
      if (!recebidos.has(chave)) recebidos.add(chave);
      expect(efeito.corpo).toBe('{"cliente":"Ana"}');
      return { ok: true as const, resultado: { status: 200 } };
    },
    commit: async (_t: string, _c: string, d: Record<string, unknown>) => (
      commits.push(d),
      'ok' as const
    ),
    expandir: (
      texto: string,
      estado: { evento: Record<string, unknown>; var: Record<string, unknown> },
    ) => texto.replace(/\{\{var\.(\w+)\}\}/g, (_, k: string) => String(estado.var[k] ?? '')),
  });

  test('webhook: o executor caiu antes de gravar; a retomada manda a mesma chave e o destino recebe uma vez', async () => {
    const recebidos = new Set<string>();
    const entregas = { n: 0 };
    const commits: unknown[] = [];
    // Primeira vez: a gravação não acontece (o executor caiu)
    await executarToken(token('w'), {
      ...base(commits, recebidos, entregas),
      commit: async () => 'ignorado',
    });
    // Reivindicado de novo (attempts muda, retries não): a mesma chave
    await executarToken(
      token('w', { claimed_at: '2026-11-25T12:03:00Z' }),
      base(commits, recebidos, entregas),
    );
    expect(entregas.n).toBe(2);
    expect([...recebidos]).toEqual(['inst1:t1:w:0']);
    expect(commits[0]).toMatchObject({
      tipo: 'seguir',
      proximos: [{ no: 'n' }],
      resultado: { status: 200 },
    });
    expect(commits[0]).not.toHaveProperty('efeito');
  });

  test('ação interna vai como efeito do V14, com o texto expandido', async () => {
    const commits: Record<string, unknown>[] = [];
    await executarToken(token('n'), base(commits, new Set(), { n: 0 }));
    expect(commits[0]).toMatchObject({
      tipo: 'seguir',
      efeito: { tipo: 'notificacao', corpo: 'Oi Ana' },
    });
  });

  test('tarefa humana espera com o título expandido; ao voltar, segue', async () => {
    const commits: Record<string, unknown>[] = [];
    await executarToken(token('h'), base(commits, new Set(), { n: 0 }));
    expect(commits[0]).toMatchObject({
      tipo: 'esperar',
      espera: { tipo: 'humana', titulo: 'Conferir Ana' },
    });
    await executarToken(
      token('h', { result: { concluida_por: 'u1' } }),
      base(commits, new Set(), { n: 0 }),
    );
    expect(commits[1]).toMatchObject({ tipo: 'seguir', proximos: [{ no: 'f' }] });
  });

  test('erro passageiro do webhook pede nova tentativa', async () => {
    const commits: Record<string, unknown>[] = [];
    await executarToken(token('w'), {
      ...base(commits, new Set(), { n: 0 }),
      externo: async () => ({ tentar: 'HTTP 503' }),
    });
    expect(commits[0]).toEqual({ tipo: 'falha', erro: 'HTTP 503', tentar: true });
  });
});

describe('funções puras (FN)', () => {
  const pura: Grafo = {
    v: 1,
    assinatura: {
      entradas: [{ nome: 'dias', tipo: 'numero' }],
      saidas: [{ nome: 'prazo', tipo: 'data' }],
    },
    nos: [
      { id: 'i', tipo: 'inicio', entradas: { prazo: 'hoje() + {var.dias}' } },
      { id: 'f', tipo: 'fim' },
    ],
    arestas: [{ id: '1', de: 'i', para: 'f' }],
  };

  test('roda em linha e devolve só as saídas da assinatura', () => {
    expect(ehFuncaoPura(pura)).toBe(true);
    expect(
      rodarPura(pura, { dias: 3 }, { hoje: '2026-11-25', agora: '2026-11-25T12:00:00Z' }, exprApi),
    ).toEqual({
      ok: true,
      saidas: { prazo: '2026-11-28' },
    });
  });

  test('o executor não cria instância filha para função pura: segue no mesmo passo', async () => {
    const chama: Grafo = {
      v: 1,
      nos: [
        {
          id: 's',
          tipo: 'subprocesso',
          funcao: '00000000-0000-4000-8000-000000000001',
          entradas: { dias: '2' },
          saidas: { quando: '{retorno.saidas.prazo}' },
        },
        { id: 'f', tipo: 'fim' },
      ],
      arestas: [{ id: '1', de: 's', para: 'f' }],
    };
    const commits: Record<string, unknown>[] = [];
    await executarToken(
      {
        token: 't',
        claimed_at: 'c',
        node: 's',
        scope: {},
        result: null,
        retries: 0,
        instance: 'i',
        vars: {},
        start: {},
        graph: chama,
        definition: 'd',
        name: 'n',
      },
      {
        expr: exprApi,
        passo: () => undefined,
        externo: async () => ({ ok: true }),
        funcao: async () => pura,
        commit: async (_t, _c, d) => (commits.push(d), 'ok'),
        agora: () => '2026-11-25T12:00:00.000Z',
      },
    );
    expect(commits[0]).toMatchObject({
      tipo: 'seguir',
      proximos: [{ no: 'f' }],
      vars: { quando: '2026-11-27' },
      resultado: { emLinha: true },
    });
  });

  test('função com tarefa ou ação não é pura', () => {
    expect(
      ehFuncaoPura({ ...pura, nos: [...pura.nos, { id: 'h', tipo: 'humana', titulo: 'x' }] }),
    ).toBe(false);
  });
});
