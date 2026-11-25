import { describe, expect, test } from '@jest/globals';

import {
  advance,
  vencimentoDe,
  avaliar,
  expandir,
  CATALOGO,
  compile,
  executeRun,
  GATILHOS,
  PASSOS,
  PASSOS_BASE,
  registroBase,
  registroCom,
  type Commit,
  type Condicao,
  type Contexto,
  type Execucao,
  type TipoPasso,
} from '@/lib/automation/registry';

// Sem @types/node no projeto: o Jest roda no Node, então o require existe
declare const require: (id: string) => unknown;

const ctx = (over: Partial<Contexto> = {}): Contexto => ({
  estado: { evento: {}, var: {} },
  escopo: 'pessoal',
  regra: { id: 'r1', nome: 'Regra' },
  agora: '2026-11-24T12:00:00Z',
  ...over,
});

const run = (passos: Execucao['definition']['passos'], over: Partial<Execucao> = {}): Execucao => ({
  id: 'run1',
  claimed_at: '2026-11-24T12:00:00Z',
  step: 0,
  state: { evento: {}, var: {} },
  scope: 'pessoal',
  rule_id: 'r1',
  rule_name: 'Regra',
  definition: { passos },
  ...over,
});

/** Banco de mentira com a mesma regra do automation_step: só grava se a execução está naquele passo. */
function fakeDb() {
  const rows = new Map<string, { step: number; status: string }>();
  const effects: { run: string; step: number; effect: unknown }[] = [];
  const commit = async (c: Commit) => {
    const row = rows.get(c.run) ?? { step: 0, status: 'rodando' };
    rows.set(c.run, row);
    if (row.status !== 'rodando' || row.step !== c.step) return 'ignorado' as const;
    if (c.effect) effects.push({ run: c.run, step: c.step, effect: c.effect });
    row.step = c.status === 'falhou' ? c.step : c.next;
    row.status = c.status;
    return 'ok' as const;
  };
  return { rows, effects, commit };
}

describe('catálogo (espelho do automation_catalog() do banco)', () => {
  test('é igual ao da migração mais nova', () => {
    const fs = require('fs') as {
      readFileSync: (p: string, e: string) => string;
      readdirSync: (p: string) => string[];
    };
    const dir = 'supabase/migrations';
    const sql =
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .map((f) => fs.readFileSync(`${dir}/${f}`, 'utf8'))
        .filter((s) => s.includes('function public.automation_catalog()'))
        .pop() ?? '';
    const body = sql.slice(sql.indexOf('function public.automation_catalog()'));
    const arr = (s: string) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const read = (section: string, next: string) => {
      const start = body.indexOf(`'${section}', jsonb_build_object(`);
      const chunk = body.slice(start, body.indexOf(`'${next}',`, start));
      const out: Record<string, { escopos: string[]; externo?: boolean }> = {};
      for (const m of chunk.matchAll(
        /'([a-z_.]+)',\s*jsonb_build_object\('escopos', jsonb_build_array\(([^)]*)\)(?:, 'externo', (true|false))?\)/g,
      )) {
        out[m[1]] = { escopos: arr(m[2]), ...(m[3] ? { externo: m[3] === 'true' } : {}) };
      }
      return out;
    };
    expect(read('gatilhos', 'passos')).toEqual(CATALOGO.gatilhos);
    expect(read('passos', 'operadores')).toEqual(CATALOGO.passos);
    const ops = /'operadores', jsonb_build_array\(([^)]*)\)/.exec(body)?.[1] ?? '';
    expect(arr(ops)).toEqual(CATALOGO.operadores);
    const prontas = /'prontas', jsonb_build_array\(([^)]*)\)/.exec(body)?.[1] ?? '';
    expect(arr(prontas)).toEqual(CATALOGO.prontas);
  });

  test('todo gatilho e passo tem rótulo', () => {
    for (const item of [...GATILHOS, ...PASSOS]) expect(item.label()).not.toMatch(/^auto\./);
  });

  test('o executor só sabe rodar passos do catálogo', () => {
    for (const t of PASSOS_BASE) expect(CATALOGO.passos).toHaveProperty(t.id);
  });
});

describe('compile e advance', () => {
  const se: TipoPasso = {
    id: 'se',
    blocos: ['entao', 'senao'],
    execute: (c) => ({ ramo: c.estado.var.x ? 'entao' : 'senao' }),
  };
  const marca: TipoPasso = {
    id: 'marca',
    execute: (_c, p) => ({ var: { [String(p.nome)]: true } }),
  };
  const reg = registroCom([se, marca]);
  const passos = [
    { tipo: 'se', entao: [{ tipo: 'marca', nome: 'a' }], senao: [{ tipo: 'marca', nome: 'b' }] },
    { tipo: 'marca', nome: 'c' },
  ];

  test('bloco vira programa linear com saltos', () => {
    const prog = compile(passos, reg);
    expect(prog).toHaveLength(6);
    expect(prog[0]).toMatchObject({ caminho: '0', blocos: { entao: 1, senao: 3 }, fim: 5 });
    expect(prog[1]).toMatchObject({ caminho: '0.entao.0' });
    expect(prog[2]).toEqual({ salto: 5 });
    expect(prog[5]).toMatchObject({ caminho: '1' });
  });

  test.each([
    [true, ['a', 'c']],
    [false, ['b', 'c']],
  ])('SE com x=%s segue o bloco certo', (x, marcadas) => {
    const prog = compile(passos, reg);
    let estado = { evento: {}, var: { x } as Record<string, unknown> };
    let pc = 0;
    for (let i = 0; i < 10 && pc < prog.length; i++) {
      const a = advance(prog, pc, ctx({ estado }), reg);
      estado = a.estado;
      pc = a.proximo;
    }
    expect(Object.keys(estado.var).filter((k) => k !== 'x')).toEqual(marcadas);
  });

  test('notificar devolve o efeito; o canal e o destino caem no padrão', () => {
    const prog = compile(
      [{ tipo: 'notificar', titulo: 'Oi', corpo: 'Texto', canal: 'fax' }],
      registroBase(),
    );
    const a = advance(prog, 0, ctx(), registroBase());
    expect(a.efeito).toEqual({
      tipo: 'notificacao',
      titulo: 'Oi',
      corpo: 'Texto',
      canal: 'ambos',
      para: 'dona',
    });
    expect(a.status).toBe('ok');
  });

  test('regra pessoal só avisa a dona', () => {
    const prog = compile(
      [{ tipo: 'notificar', corpo: 'x', para: 'pessoa', pessoa: 'p2' }],
      registroBase(),
    );
    expect(advance(prog, 0, ctx(), registroBase()).efeito).toMatchObject({ para: 'dona' });
    expect(advance(prog, 0, ctx({ escopo: 'projeto' }), registroBase()).efeito).toMatchObject({
      para: 'pessoa',
      pessoa: 'p2',
    });
  });

  test('aviso sem texto falha', () => {
    const prog = compile([{ tipo: 'notificar' }], registroBase());
    expect(advance(prog, 0, ctx(), registroBase())).toMatchObject({ status: 'falhou' });
  });

  test('parar encerra com sucesso', () => {
    const prog = compile([{ tipo: 'parar' }, { tipo: 'notificar', corpo: 'x' }], registroBase());
    expect(advance(prog, 0, ctx(), registroBase())).toMatchObject({ status: 'ok', proximo: 2 });
  });

  test('passo que ainda não existe no executor falha com mensagem', () => {
    const prog = compile([{ tipo: 'enviar_webhook', url: 'https://x' }], registroBase());
    expect(advance(prog, 0, ctx(), registroBase()).erro).toMatch(/enviar_webhook/);
  });
});

describe('executeRun', () => {
  test('tipo de passo novo só pelo registro, sem mudar o executor', async () => {
    const eco: TipoPasso = {
      id: 'eco_teste',
      execute: (_c, p) => ({ efeito: { tipo: 'eco', texto: p.texto } }),
    };
    const db = fakeDb();
    const res = await executeRun(
      run([{ tipo: 'eco_teste', texto: 'oi' }]),
      registroCom([eco]),
      db.commit,
    );
    expect(res).toBe('ok');
    expect(db.effects).toEqual([{ run: 'run1', step: 0, effect: { tipo: 'eco', texto: 'oi' } }]);
  });

  test('a mesma execução entregue duas vezes não repete o aviso', async () => {
    const db = fakeDb();
    const r = run([{ tipo: 'notificar', corpo: 'Oi' }]);
    await executeRun(r, registroBase(), db.commit);
    expect(await executeRun(r, registroBase(), db.commit)).toBe('ignorado');
    expect(db.effects).toHaveLength(1);
  });

  test('retoma do passo em que parou', async () => {
    const db = fakeDb();
    db.rows.set('run1', { step: 1, status: 'rodando' });
    const r = run(
      [
        { tipo: 'notificar', corpo: 'primeiro' },
        { tipo: 'notificar', corpo: 'segundo' },
      ],
      { step: 1 },
    );
    await executeRun(r, registroBase(), db.commit);
    expect(db.effects.map((e) => (e.effect as { corpo: string }).corpo)).toEqual(['segundo']);
  });

  test('falha para a execução no passo', async () => {
    const db = fakeDb();
    const res = await executeRun(
      run([
        { tipo: 'enviar_webhook', url: 'https://x' },
        { tipo: 'notificar', corpo: 'x' },
      ]),
      registroBase(),
      db.commit,
    );
    expect(res).toBe('falhou');
    expect(db.effects).toHaveLength(0);
    expect(db.rows.get('run1')).toEqual({ step: 0, status: 'falhou' });
  });
});

describe('textos com {{ }} (V14 §2.1)', () => {
  const c = ctx({
    estado: {
      evento: {
        titulo: 'Comprar o presente de aniversário da tia Lurdes no sábado',
        etiquetas: ['casa', 'rua'],
        vencimento: '2026-12-05',
      },
      var: { x: 3 },
    },
    usuario: { nome: 'Ana', nivel: 7 },
    fuso: 'America/Sao_Paulo',
  });

  test('corta:40 e variável inexistente vira vazio com aviso', () => {
    const avisos: string[] = [];
    expect(expandir('{{evento.titulo|corta:40}}', c, avisos)).toBe(
      'Comprar o presente de aniversário da tia',
    );
    expect(avisos).toEqual([]);
    expect(expandir('[{{evento.nada}}]', c, avisos)).toBe('[]');
    expect(avisos).toEqual(['Variável inexistente: evento.nada']);
  });

  test('padrao cobre a falta sem aviso', () => {
    const avisos: string[] = [];
    expect(expandir('{{ evento.lista_nome | padrao:"sem lista" }}', c, avisos)).toBe('sem lista');
    expect(avisos).toEqual([]);
  });

  test.each([
    ['{{event.title|cut:7}}', 'Comprar'],
    ['{{evento.titulo|recorta:7}}', 'Comprar'],
    ['{{user.level}} / {{usuario.nome}}', '7 / Ana'],
    ['{{evento.etiquetas}}', 'casa, rua'],
    ['{{var.x}}', '3'],
    ['{{evento.vencimento|data}}', '05/12/2026'],
    ['{{event.due|date}}', '05/12/2026'],
    ['{{agora|hora}}', '09:00'],
  ])('%s → %s', (t, out) => {
    expect(expandir(t, c, [])).toBe(out);
  });

  test('texto expandido tem no máximo 2.000 caracteres', () => {
    const longo = ctx({ estado: { evento: { t: 'x'.repeat(3000) }, var: {} } });
    expect(expandir('{{evento.t}}', longo, [])).toHaveLength(2000);
  });
});

describe('condições (V14 §4)', () => {
  const em = (agora: string, evento: Record<string, unknown> = {}) =>
    ctx({ agora, fuso: 'America/Sao_Paulo', estado: { evento, var: {} }, usuario: { nivel: 5 } });
  // 2026-11-24 é terça; 01:30 UTC = 22:30 de segunda em São Paulo
  const segundaNoite = em('2026-11-24T01:30:00Z', {
    titulo: 'Relatório mensal',
    etiquetas: ['trabalho'],
    prioridade: 2,
  });

  test.each([
    [{ pronta: 'janela_horario', de: '22:00', ate: '06:00' }, true],
    [{ pronta: 'janela_horario', de: '08:00', ate: '18:00' }, false],
    [{ pronta: 'dias_semana', dias: [1] }, true],
    [{ pronta: 'dias_semana', dias: [2] }, false],
    [{ pronta: 'etiqueta', etiqueta: '#Trabalho' }, true],
    [{ pronta: 'nivel_min', nivel: 5 }, true],
    [{ pronta: 'nivel_min', nivel: 6 }, false],
    [{ campo: 'evento.titulo', op: 'comeca_com', valor: 'relat' }, true],
    [{ campo: 'evento.prioridade', op: '≥', valor: '2' }, true],
    [{ campo: 'evento.prioridade', op: 'em', valor: '1, 2' }, true],
    [{ campo: 'evento.etiquetas', op: 'contem', valor: 'trabalho' }, true],
    [{ campo: 'evento.lista', op: 'vazio' }, true],
    [{ campo: 'evento.lista', op: '≠', valor: 'x' }, true],
  ])('%j → %s', (cond, esperado) => {
    expect(avaliar(cond as Condicao, segundaNoite, [])).toBe(esperado);
  });

  test('janela que cruza a meia-noite: 05:59 dentro, 06:00 fora', () => {
    const janela = { pronta: 'janela_horario', de: '22:00', ate: '06:00' } as Condicao;
    expect(avaliar(janela, em('2026-11-24T08:59:00Z'), [])).toBe(true);
    expect(avaliar(janela, em('2026-11-24T09:00:00Z'), [])).toBe(false);
  });

  test('E, OU e NÃO em 3 níveis', () => {
    const cond = {
      e: [
        {
          ou: [
            { campo: 'evento.titulo', op: 'contem', valor: 'nada' },
            { nao: { pronta: 'dias_semana', dias: [0, 6] } },
          ],
        },
        { campo: 'evento.prioridade', op: '<', valor: 3 },
      ],
    } as Condicao;
    expect(avaliar(cond, segundaNoite, [])).toBe(true);
    expect(avaliar({ nao: cond } as Condicao, segundaNoite, [])).toBe(false);
  });

  test('erro de tipo vira falsa com aviso, sem exceção', () => {
    const avisos: string[] = [];
    expect(avaliar({ campo: 'evento.titulo', op: '>', valor: 3 }, segundaNoite, avisos)).toBe(
      false,
    );
    expect(avisos[0]).toMatch(/Não dá para comparar/);
  });

  test('condições da regra que não batem: a execução acaba sem efeito', async () => {
    const db = fakeDb();
    const r = run([{ tipo: 'notificar', corpo: 'x' }], {
      definition: {
        condicoes: { pronta: 'dias_semana', dias: [0] },
        passos: [{ tipo: 'notificar', corpo: 'x' }],
      },
      fuso: 'America/Sao_Paulo',
    });
    expect(await executeRun(r, registroBase(), db.commit, () => '2026-11-24T01:30:00Z')).toBe('ok');
    expect(db.effects).toHaveLength(0);
  });

  test('SE escolhe o bloco pela condição e o aviso usa o texto expandido', async () => {
    const db = fakeDb();
    const r = run(
      [
        {
          tipo: 'se',
          condicao: { campo: 'evento.titulo', op: 'contem', valor: 'mensal' },
          entao: [{ tipo: 'notificar', corpo: 'Feito: {{evento.titulo|corta:9}}' }],
          senao: [{ tipo: 'notificar', corpo: 'outro' }],
        },
      ],
      { state: { evento: { titulo: 'Relatório mensal' }, var: {} } },
    );
    await executeRun(r, registroBase(), db.commit);
    expect(db.effects.map((e) => (e.effect as { corpo: string }).corpo)).toEqual([
      'Feito: Relatório',
    ]);
  });
});

describe('ações (AU4)', () => {
  const reg = registroBase();
  const um = (passo: Record<string, unknown>, c: Contexto = ctx()) =>
    advance(compile([passo as never], reg), 0, c, reg);
  const comEvento = ctx({
    estado: {
      evento: {
        tarefa: '11111111-1111-4111-8111-111111111111',
        titulo: 'Pagar a luz',
        lista: '22222222-2222-4222-8222-222222222222',
      },
      var: {},
    },
    fuso: 'America/Sao_Paulo',
  });

  test('criar tarefa: título e lista com variáveis, vencimento +N dias no fuso da dona', () => {
    const a = um(
      {
        tipo: 'criar_tarefa',
        titulo: 'Conferir: {{evento.titulo}}',
        lista: '{{evento.lista}}',
        vencimento: '+2',
        etiquetas: ['#Casa'],
      },
      comEvento,
    );
    expect(a.efeito).toEqual({
      tipo: 'criar_tarefa',
      titulo: 'Conferir: Pagar a luz',
      lista: '22222222-2222-4222-8222-222222222222',
      vencimento: '2026-11-26',
      etiquetas: ['casa'],
    });
    expect(a.estado.meta).toEqual({ tarefas: 1 });
  });

  test('no máximo 20 tarefas por execução', () => {
    const cheio = ctx({ estado: { evento: {}, var: {}, meta: { tarefas: 20 } } });
    expect(um({ tipo: 'criar_tarefa', titulo: 'x' }, cheio).erro).toMatch(/20/);
  });

  test.each([
    ['2026-12-01', '2026-12-01'],
    ['+1 dia', '2026-11-25'],
    ['+3 days', '2026-11-27'],
    ['+0', '2026-11-24'],
  ])('vencimento %s → %s', (v, out) => {
    expect(vencimentoDe(v, ctx({ fuso: 'America/Sao_Paulo' }), [])).toBe(out);
  });

  test('atualizar tarefa só manda etiquetas, lista e vencimento (V14-5)', () => {
    const a = um(
      {
        tipo: 'atualizar_tarefa',
        adicionar_etiquetas: ['x'],
        status: 'done',
        concluir: true,
        apagar: true,
        reabrir: true,
      },
      comEvento,
    );
    expect(a.efeito).toEqual({ tipo: 'atualizar_tarefa', adicionar_etiquetas: ['x'] });
  });

  test('definir variável: número vira número e o texto é expandido', () => {
    const a = um({ tipo: 'definir_variavel', nome: 'n', valor: '42' });
    expect(a.estado.var).toEqual({ n: 42 });
    expect(
      um({ tipo: 'definir_variavel', nome: 't', valor: '{{evento.titulo}}!' }, comEvento).estado
        .var,
    ).toEqual({ t: 'Pagar a luz!' });
    expect(um({ tipo: 'definir_variavel', nome: 'Errado', valor: 1 }).erro).toBeDefined();
  });

  test('executar regra: sem ciclo e até 3 em sequência', () => {
    const outra = '33333333-3333-4333-8333-333333333333';
    expect(um({ tipo: 'executar_regra', regra: outra }).efeito).toEqual({
      tipo: 'executar_regra',
      regra: outra,
    });
    const emCadeia = ctx({ estado: { evento: { _cadeia: [outra] }, var: {} } });
    expect(um({ tipo: 'executar_regra', regra: outra }, emCadeia).erro).toMatch(/círculo/);
    const funda = ctx({ estado: { evento: { _cadeia: ['a', 'b'] }, var: {} } });
    expect(um({ tipo: 'executar_regra', regra: outra }, funda).erro).toMatch(/3/);
  });

  test('descanso entre 5 s e 1 h; modo jogo só os três valores', () => {
    expect(um({ tipo: 'descanso', segundos: 9999 }).efeito).toEqual({
      tipo: 'descanso',
      segundos: 3600,
    });
    expect(um({ tipo: 'alternar_modo_jogo', modo: 'full' }).efeito).toEqual({
      tipo: 'alternar_modo_jogo',
      modo: 'full',
    });
    expect(um({ tipo: 'alternar_modo_jogo', modo: 'hard' }).erro).toBeDefined();
  });

  test('criar, definir, se e parar numa execução só', async () => {
    const db = fakeDb();
    const r = run([
      { tipo: 'definir_variavel', nome: 'feito', valor: 'sim' },
      {
        tipo: 'se',
        condicao: { campo: 'var.feito', op: '=', valor: 'sim' },
        entao: [
          { tipo: 'criar_tarefa', titulo: 'Depois', lista: '22222222-2222-4222-8222-222222222222' },
          { tipo: 'parar' },
        ],
      },
      { tipo: 'notificar', corpo: 'não sai' },
    ]);
    expect(await executeRun(r, reg, db.commit)).toBe('ok');
    expect(db.effects.map((e) => (e.effect as { tipo: string }).tipo)).toEqual(['criar_tarefa']);
  });
});
