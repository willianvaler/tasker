// Motor das automações (ESCOPO_V14 §6.1 e §6.3, AU2, D334). Sem imports: roda no Node/Metro (testes e
// o app, por src/lib/automation/registry.ts) e no Deno (Edge Function `automation-run`).
//
// - CATALOGO: os ids de gatilho e passo com escopo e efeito externo, espelho do automation_catalog()
//   do banco (o teste compara). Quem valida a definição é o banco (automation_validate).
// - Registro de tipos de passo: cada tipo declara blocos (SE tem `entao`/`senao`) e um `execute` puro
//   (estado + parâmetros → resultado). O executor (`executeRun`) só conhece o registro: tipo novo
//   (os do V16 também) entra com `register`, sem mexer aqui.
// - A definição vira um programa linear (`compile`), e o ponteiro (`automation_runs.step`) é um número:
//   a execução para e retoma em qualquer passo, inclusive depois de um reinício.
// - Efeitos (avisar, criar tarefa) não acontecem aqui: o passo devolve o efeito e o `commit` do
//   executor grava efeito e avanço juntos no banco (automation_step), uma vez por (execução, passo).

export type Escopo = 'pessoal' | 'projeto';

type Meta = { escopos: Escopo[]; externo?: boolean };

const AMBOS: Escopo[] = ['pessoal', 'projeto'];
const PESSOAL: Escopo[] = ['pessoal'];

export const CATALOGO = {
  gatilhos: {
    'tarefa.criada': { escopos: AMBOS },
    'tarefa.concluida': { escopos: AMBOS },
    'tarefa.atrasada': { escopos: AMBOS },
    'tarefa.vencendo': { escopos: AMBOS },
    'tarefa.pronta': { escopos: AMBOS },
    'tarefa.atribuida': { escopos: AMBOS },
    'lista.concluida': { escopos: AMBOS },
    'marco.atingido': { escopos: AMBOS },
    'nivel.subiu': { escopos: PESSOAL },
    'boss.derrotado': { escopos: PESSOAL },
    horario: { escopos: PESSOAL },
    intervalo: { escopos: PESSOAL },
    webhook: { escopos: PESSOAL },
    manual: { escopos: AMBOS },
  } as Record<string, Meta>,
  passos: {
    notificar: { escopos: AMBOS, externo: false },
    criar_tarefa: { escopos: AMBOS, externo: false },
    atualizar_tarefa: { escopos: AMBOS, externo: false },
    atribuir: { escopos: ['projeto'], externo: false },
    descanso: { escopos: AMBOS, externo: false },
    enviar_webhook: { escopos: PESSOAL, externo: true },
    comandar_dispositivo: { escopos: PESSOAL, externo: true },
    esperar: { escopos: AMBOS, externo: false },
    executar_regra: { escopos: AMBOS, externo: false },
    definir_variavel: { escopos: AMBOS, externo: false },
    se: { escopos: AMBOS, externo: false },
    parar: { escopos: AMBOS, externo: false },
    alternar_modo_jogo: { escopos: PESSOAL, externo: false },
  } as Record<string, Meta>,
  operadores: ['=', '≠', '<', '≤', '>', '≥', 'contem', 'comeca_com', 'em', 'vazio'],
  prontas: ['janela_horario', 'dias_semana', 'projeto', 'lista', 'etiqueta', 'nivel_min'],
};

export type Passo = { tipo: string; [chave: string]: unknown };

/** O que a execução carrega de um passo para o outro (vai para automation_runs.state). */
export type Estado = {
  evento: Record<string, unknown>;
  var: Record<string, unknown>;
};

export type Contexto = {
  estado: Estado;
  escopo: Escopo;
  regra: { id: string; nome: string };
  /** Instante da execução (ISO), para passos que dependem da hora. */
  agora: string;
};

/** Efeito que o banco aplica junto com o avanço do passo. `tipo` é do lado do banco (_automation_effect). */
export type Efeito = { tipo: string; [chave: string]: unknown };

export type Resultado = {
  efeito?: Efeito;
  /** Variáveis novas ou trocadas (somam às que existem). */
  var?: Record<string, unknown>;
  /** Para tipos com blocos: qual bloco seguir (ou nenhum). */
  ramo?: string | null;
  /** Encerra a execução com sucesso. */
  parar?: boolean;
  /** Erro do passo: a execução falha com esta mensagem. */
  erro?: string;
  /** Avisos que não derrubam o passo (variável que não existe etc.). */
  avisos?: string[];
};

export type TipoPasso = {
  id: string;
  /** Blocos de passos dentro deste (SE: ['entao', 'senao']). */
  blocos?: string[];
  execute: (ctx: Contexto, params: Passo) => Resultado;
};

export type Registro = {
  get: (id: string) => TipoPasso | undefined;
  register: (tipo: TipoPasso) => Registro;
};

export function createRegistry(tipos: TipoPasso[] = []): Registro {
  const map = new Map<string, TipoPasso>();
  const registro: Registro = {
    get: (id) => map.get(id),
    register: (tipo) => {
      map.set(tipo.id, tipo);
      return registro;
    },
  };
  for (const tipo of tipos) registro.register(tipo);
  return registro;
}

// ---------------------------------------------------------------------------------------------
// Programa linear
// ---------------------------------------------------------------------------------------------

/** Instrução: um passo (com o destino de cada bloco e do fim) ou um salto. */
export type Instrucao =
  | { passo: Passo; caminho: string; blocos?: Record<string, number>; fim?: number }
  | { salto: number };

/**
 * Achata os passos: o passo com blocos vem seguido do corpo de cada bloco, e cada corpo termina num
 * salto para depois do último. Passo de tipo desconhecido entra como está (falha quando for a vez dele).
 */
export function compile(passos: Passo[], registro: Registro, prefixo = ''): Instrucao[] {
  const out: Instrucao[] = [];
  const emit = (lista: Passo[], base: string) => {
    lista.forEach((passo, i) => {
      const caminho = base ? `${base}.${i}` : String(i);
      const nomes = registro.get(passo.tipo)?.blocos ?? [];
      if (nomes.length === 0) {
        out.push({ passo, caminho });
        return;
      }
      const blocos: Record<string, number> = {};
      const inst: Extract<Instrucao, { passo: Passo }> = { passo, caminho, blocos };
      out.push(inst);
      const saltos: { salto: number }[] = [];
      for (const nome of nomes) {
        blocos[nome] = out.length;
        const corpo = passo[nome];
        emit(Array.isArray(corpo) ? (corpo as Passo[]) : [], `${caminho}.${nome}`);
        const salto = { salto: -1 };
        saltos.push(salto);
        out.push(salto);
      }
      inst.fim = out.length;
      for (const s of saltos) s.salto = out.length;
    });
  };
  emit(passos, prefixo);
  return out;
}

/** Linha do histórico de um passo (automation_runs.steps). */
export type LinhaPasso = { caminho: string; tipo: string; ok: boolean; erro?: string; ramo?: string | null };

export type Avanco = {
  /** Próximo ponteiro (igual a program.length: acabou). */
  proximo: number;
  estado: Estado;
  efeito?: Efeito;
  status: 'rodando' | 'ok' | 'falhou';
  erro?: string;
  avisos: string[];
  log?: LinhaPasso;
};

/** Um passo: puro. Saltos são seguidos sem virar passo. */
export function advance(programa: Instrucao[], pc: number, ctx: Contexto, registro: Registro): Avanco {
  let p = pc;
  while (p < programa.length) {
    const inst = programa[p];
    if (!('salto' in inst)) break;
    p = inst.salto;
  }
  if (p >= programa.length) return { proximo: programa.length, estado: ctx.estado, status: 'ok', avisos: [] };
  const inst = programa[p] as Extract<Instrucao, { passo: Passo }>;
  const tipo = registro.get(inst.passo.tipo);
  const base = { caminho: inst.caminho, tipo: inst.passo.tipo };
  if (!tipo) {
    const erro = `Passo "${inst.passo.tipo}" ainda não está disponível`;
    return { proximo: p, estado: ctx.estado, status: 'falhou', erro, avisos: [], log: { ...base, ok: false, erro } };
  }
  let r: Resultado;
  try {
    r = tipo.execute(ctx, inst.passo);
  } catch (e) {
    r = { erro: e instanceof Error ? e.message : String(e) };
  }
  if (r.erro) {
    return { proximo: p, estado: ctx.estado, status: 'falhou', erro: r.erro, avisos: r.avisos ?? [], log: { ...base, ok: false, erro: r.erro } };
  }
  const estado: Estado = r.var ? { ...ctx.estado, var: { ...ctx.estado.var, ...r.var } } : ctx.estado;
  let proximo = p + 1;
  if (inst.blocos) proximo = r.ramo && r.ramo in inst.blocos ? inst.blocos[r.ramo] : (inst.fim ?? p + 1);
  if (r.parar) proximo = programa.length;
  const log: LinhaPasso = inst.blocos ? { ...base, ok: true, ramo: r.ramo ?? null } : { ...base, ok: true };
  return {
    proximo,
    estado,
    efeito: r.efeito,
    status: proximo >= programa.length ? 'ok' : 'rodando',
    avisos: r.avisos ?? [],
    log,
  };
}

// ---------------------------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------------------------

/** Execução reivindicada (o que o automation_claim devolve). */
export type Execucao = {
  id: string;
  claimed_at: string;
  step: number;
  state: Partial<Estado>;
  scope: Escopo;
  rule_id: string;
  rule_name: string;
  definition: { passos?: Passo[] };
};

export type Commit = {
  run: string;
  claim: string;
  step: number;
  next: number;
  state: Estado;
  effect: Efeito | null;
  log: LinhaPasso | null;
  warnings: string[];
  status: 'rodando' | 'ok' | 'falhou';
  error: string | null;
};

/** Grava o passo no banco. 'ignorado': outro executor já fez este passo (ou a execução mudou). */
export type CommitFn = (c: Commit) => Promise<'ok' | 'ignorado' | 'falhou'>;

/**
 * Roda uma execução do ponto em que parou até o fim, um commit por passo. O commit com efeito é
 * idempotente no banco: se o mesmo passo chegar duas vezes, o segundo é ignorado e o executor para.
 */
export async function executeRun(
  run: Execucao,
  registro: Registro,
  commit: CommitFn,
  agora: () => string = () => new Date().toISOString(),
): Promise<'ok' | 'falhou' | 'ignorado'> {
  const programa = compile(run.definition.passos ?? [], registro);
  let estado: Estado = { evento: run.state.evento ?? {}, var: run.state.var ?? {} };
  let pc = run.step;
  for (let guarda = 0; guarda <= programa.length + 1; guarda++) {
    const ctx: Contexto = { estado, escopo: run.scope, regra: { id: run.rule_id, nome: run.rule_name }, agora: agora() };
    const a = advance(programa, pc, ctx, registro);
    const res = await commit({
      run: run.id,
      claim: run.claimed_at,
      step: pc,
      next: a.proximo,
      state: a.estado,
      effect: a.efeito ?? null,
      log: a.log ?? null,
      warnings: a.avisos,
      status: a.status,
      error: a.erro ?? null,
    });
    if (res !== 'ok') return res;
    if (a.status !== 'rodando') return a.status;
    estado = a.estado;
    pc = a.proximo;
  }
  return 'falhou';
}

// ---------------------------------------------------------------------------------------------
// Tipos de passo do AU2 (os outros chegam no AU3 a AU5 e no SL3)
// ---------------------------------------------------------------------------------------------

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export const PASSOS_BASE: TipoPasso[] = [
  {
    id: 'notificar',
    execute: (ctx, p) => {
      const titulo = texto(p.titulo, 80);
      const corpo = texto(p.corpo, 240);
      if (!titulo && !corpo) return { erro: 'O aviso precisa de título ou texto' };
      const canal = p.canal === 'app' || p.canal === 'push' ? p.canal : 'ambos';
      const para = ctx.escopo === 'pessoal' ? 'dona' : p.para === 'responsaveis' || p.para === 'pessoa' ? p.para : 'dona';
      return {
        efeito: {
          tipo: 'notificacao',
          titulo,
          corpo,
          canal,
          para,
          ...(para === 'pessoa' && typeof p.pessoa === 'string' ? { pessoa: p.pessoa } : {}),
        },
      };
    },
  },
  { id: 'parar', execute: () => ({ parar: true }) },
];

export const registroBase = () => createRegistry(PASSOS_BASE);
