import { describe, expect, test } from '@jest/globals';

import {
  advance,
  CATALOGO,
  compile,
  executeRun,
  GATILHOS,
  PASSOS,
  PASSOS_BASE,
  registroBase,
  registroCom,
  type Commit,
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
  const marca: TipoPasso = { id: 'marca', execute: (_c, p) => ({ var: { [String(p.nome)]: true } }) };
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
    const prog = compile([{ tipo: 'notificar', titulo: 'Oi', corpo: 'Texto', canal: 'fax' }], registroBase());
    const a = advance(prog, 0, ctx(), registroBase());
    expect(a.efeito).toEqual({ tipo: 'notificacao', titulo: 'Oi', corpo: 'Texto', canal: 'ambos', para: 'dona' });
    expect(a.status).toBe('ok');
  });

  test('regra pessoal só avisa a dona', () => {
    const prog = compile([{ tipo: 'notificar', corpo: 'x', para: 'pessoa', pessoa: 'p2' }], registroBase());
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
    const prog = compile([{ tipo: 'criar_tarefa', titulo: 'x' }], registroBase());
    expect(advance(prog, 0, ctx(), registroBase()).erro).toMatch(/criar_tarefa/);
  });
});

describe('executeRun', () => {
  test('tipo de passo novo só pelo registro, sem mudar o executor', async () => {
    const eco: TipoPasso = { id: 'eco_teste', execute: (_c, p) => ({ efeito: { tipo: 'eco', texto: p.texto } }) };
    const db = fakeDb();
    const res = await executeRun(run([{ tipo: 'eco_teste', texto: 'oi' }]), registroCom([eco]), db.commit);
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
      run([{ tipo: 'descanso', segundos: 30 }, { tipo: 'notificar', corpo: 'x' }]),
      registroBase(),
      db.commit,
    );
    expect(res).toBe('falhou');
    expect(db.effects).toHaveLength(0);
    expect(db.rows.get('run1')).toEqual({ step: 0, status: 'falhou' });
  });
});
