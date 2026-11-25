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
  /** Contadores da execução (tarefas criadas etc.), para os limites por execução. */
  meta?: Record<string, number>;
};

export type Contexto = {
  estado: Estado;
  escopo: Escopo;
  regra: { id: string; nome: string };
  /** Instante da execução (ISO), para passos que dependem da hora. */
  agora: string;
  /** Fuso IANA e idioma da dona (horário, dias da semana e os filtros |data e |hora). */
  fuso?: string;
  idioma?: string;
  /** `usuario.*`: nome, nível, sequência e XP da dona, só leitura. */
  usuario?: Record<string, unknown>;
};

/** Efeito que o banco aplica junto com o avanço do passo. `tipo` é do lado do banco (_automation_effect). */
export type Efeito = { tipo: string; [chave: string]: unknown };

export type Resultado = {
  efeito?: Efeito;
  /** Variáveis novas ou trocadas (somam às que existem). */
  var?: Record<string, unknown>;
  /** Contadores que somam aos da execução. */
  meta?: Record<string, number>;
  /** Para tipos com blocos: qual bloco seguir (ou nenhum). */
  ramo?: string | null;
  /** Para a execução e volta depois de N minutos (o estado fica no banco). */
  esperar?: number;
  /** Erro passageiro (rede, 5xx): o mesmo passo de novo depois de 1, 5 e 30 min. */
  tentar?: string;
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
  /** Efeito para fora do app (webhook, dispositivo): quem faz é o executor, com chave de idempotência. */
  externo?: boolean;
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
// Variáveis e textos com {{ }} (V14 §2.1)
// ---------------------------------------------------------------------------------------------
// Nomes canônicos em pt-BR, com apelidos em inglês e espanhol. Ficam aqui (e não no i18n) porque o
// motor roda no Deno, sem o app: são os mesmos nos três idiomas da interface.

const ESPACOS: Record<string, string> = {
  evento: 'evento',
  event: 'evento',
  usuario: 'usuario',
  user: 'usuario',
  usuaria: 'usuario',
  agora: 'agora',
  now: 'agora',
  ahora: 'agora',
  var: 'var',
  variavel: 'var',
  variable: 'var',
  hook: 'hook',
  webhook: 'hook',
  dispositivo: 'dispositivo',
  device: 'dispositivo',
};

const CAMPOS: Record<string, string> = {
  task: 'tarefa',
  tarea: 'tarefa',
  title: 'titulo',
  name: 'nome',
  nombre: 'nome',
  list: 'lista',
  list_name: 'lista_nome',
  lista_nombre: 'lista_nome',
  project: 'projeto',
  proyecto: 'projeto',
  project_name: 'projeto_nome',
  proyecto_nombre: 'projeto_nome',
  labels: 'etiquetas',
  tags: 'etiquetas',
  due: 'vencimento',
  due_date: 'vencimento',
  vencimiento: 'vencimento',
  time: 'hora',
  due_time: 'hora',
  completed_at: 'concluida_em',
  completada_en: 'concluida_em',
  by: 'por',
  by_name: 'por_nome',
  por_nombre: 'por_nome',
  person: 'pessoa',
  persona: 'pessoa',
  person_name: 'pessoa_nome',
  persona_nombre: 'pessoa_nome',
  level: 'nivel',
  previous_level: 'nivel_anterior',
  nivel_previo: 'nivel_anterior',
  streak: 'sequencia',
  racha: 'sequencia',
  milestone: 'marco',
  hito: 'marco',
  milestone_name: 'marco_nome',
  hito_nombre: 'marco_nome',
  boss_name: 'boss_nome',
  jefe: 'boss',
  jefe_nombre: 'boss_nome',
};

const FILTROS: Record<string, string> = {
  data: 'data',
  date: 'data',
  fecha: 'data',
  hora: 'hora',
  time: 'hora',
  corta: 'corta',
  cut: 'corta',
  truncate: 'corta',
  recorta: 'corta',
  padrao: 'padrao',
  default: 'padrao',
  predeterminado: 'padrao',
};

/** Limite de um texto depois de expandido (V14 §2.1). */
export const MAX_TEXTO = 2000;

type Achado = { achou: boolean; valor: unknown };

/** Lê `evento.titulo`, `usuario.nivel`, `agora`, `var.x` (com os apelidos). */
export function resolver(caminho: string, ctx: Contexto): Achado {
  const partes = caminho.trim().split('.').filter(Boolean);
  const espaco = ESPACOS[(partes.shift() ?? '').toLowerCase()];
  if (!espaco) return { achou: false, valor: undefined };
  if (espaco === 'agora')
    return partes.length ? { achou: false, valor: undefined } : { achou: true, valor: ctx.agora };
  let atual: unknown =
    espaco === 'evento'
      ? ctx.estado.evento
      : espaco === 'var'
        ? ctx.estado.var
        : espaco === 'usuario'
          ? (ctx.usuario ?? {})
          : (ctx.estado.evento as Record<string, unknown>)[espaco];
  for (const parte of partes) {
    if (atual === null || typeof atual !== 'object' || Array.isArray(atual))
      return { achou: false, valor: undefined };
    const obj = atual as Record<string, unknown>;
    const chave = parte in obj ? parte : (CAMPOS[parte.toLowerCase()] ?? parte.toLowerCase());
    if (!(chave in obj)) return { achou: false, valor: undefined };
    atual = obj[chave];
  }
  return { achou: atual !== undefined, valor: atual };
}

const comoTexto = (v: unknown): string =>
  v === null || v === undefined
    ? ''
    : Array.isArray(v)
      ? v.map(comoTexto).join(', ')
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v);

const DATA_SO = /^\d{4}-\d{2}-\d{2}$/;

function formatar(v: string, filtro: 'data' | 'hora', ctx: Contexto): string | null {
  if (!v) return '';
  if (filtro === 'hora' && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);
  const soData = DATA_SO.test(v);
  const d = new Date(soData ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return null;
  const timeZone = soData ? 'UTC' : (ctx.fuso ?? 'UTC');
  try {
    return new Intl.DateTimeFormat(
      ctx.idioma ?? 'pt-BR',
      filtro === 'data'
        ? { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }
        : { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
    ).format(d);
  } catch {
    return null;
  }
}

/** Separa `evento.titulo | corta:40 | padrao:"a|b"` respeitando as aspas. */
function partir(expr: string): string[] {
  const out: string[] = [];
  let atual = '';
  let aspas = false;
  for (const c of expr) {
    if (c === '"') aspas = !aspas;
    if (c === '|' && !aspas) {
      out.push(atual.trim());
      atual = '';
    } else atual += c;
  }
  out.push(atual.trim());
  return out;
}

/**
 * Troca cada `{{ caminho | filtro }}` pelo valor. Variável que não existe vira texto vazio e deixa
 * um aviso (não derruba o passo); `|padrao:"x"` cobre a falta sem aviso.
 */
export function expandir(texto: string, ctx: Contexto, avisos: string[]): string {
  const out = texto.replace(/\{\{([^{}]*)\}\}/g, (_, expr: string) => {
    const [caminho, ...filtros] = partir(expr);
    const { achou, valor } = resolver(caminho, ctx);
    let v = comoTexto(valor);
    let faltou = !achou;
    for (const f of filtros) {
      const i = f.indexOf(':');
      const nome = FILTROS[(i < 0 ? f : f.slice(0, i)).trim().toLowerCase()];
      const arg = i < 0 ? '' : f.slice(i + 1).trim();
      if (nome === 'data' || nome === 'hora') {
        const r = formatar(v, nome, ctx);
        if (r === null) avisos.push(`Não deu para ler "${v}" como ${nome}`);
        else v = r;
      } else if (nome === 'corta') {
        const n = Number(arg);
        if (Number.isInteger(n) && n >= 0) v = v.slice(0, n);
        else avisos.push(`Filtro corta precisa de um número: ${f}`);
      } else if (nome === 'padrao') {
        if (!v) v = arg.replace(/^"(.*)"$/, '$1');
        faltou = false;
      } else {
        avisos.push(`Filtro desconhecido: ${f}`);
      }
    }
    if (faltou) avisos.push(`Variável inexistente: ${caminho}`);
    return v;
  });
  return out.slice(0, MAX_TEXTO);
}

// ---------------------------------------------------------------------------------------------
// Condições (V14 §4): E, OU, NÃO, comparações e condições prontas
// ---------------------------------------------------------------------------------------------

export type Condicao =
  | { e: Condicao[] }
  | { ou: Condicao[] }
  | { nao: Condicao }
  | { pronta: string; [chave: string]: unknown }
  | { campo: string; op: string; valor?: unknown };

/** Orçamento de nós por avaliação (V14 §4). */
const ORCAMENTO = 1000;

const numero = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const igual = (a: unknown, b: unknown) => {
  const na = numero(a);
  const nb = numero(b);
  if (na !== null && nb !== null) return na === nb;
  return comoTexto(a).toLowerCase() === comoTexto(b).toLowerCase();
};
const vazio = (v: unknown) =>
  v === null ||
  v === undefined ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>;

/** Hora (minutos do dia) e dia da semana (0 = domingo) no fuso da dona. */
export function horaLocal(ctx: Contexto, avisos: string[]): { minutos: number; dia: number } {
  const d = new Date(ctx.agora);
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat('en-US', {
      timeZone: ctx.fuso ?? 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(d);
  } catch {
    avisos.push(`Fuso desconhecido: ${ctx.fuso}`);
    partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(d);
  }
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return {
    minutos: Number(get('hour')) * 60 + Number(get('minute')),
    dia: DIAS[get('weekday')] ?? 0,
  };
}

const minutosDe = (hhmm: unknown) => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function pronta(
  c: { pronta: string; [k: string]: unknown },
  ctx: Contexto,
  avisos: string[],
): boolean {
  const evento = ctx.estado.evento;
  switch (c.pronta) {
    case 'janela_horario': {
      const de = minutosDe(c.de);
      const ate = minutosDe(c.ate);
      if (de === null || ate === null) {
        avisos.push('Janela de horário sem de/até');
        return false;
      }
      const agora = horaLocal(ctx, avisos).minutos;
      // Das 22:00 às 06:00 atravessa a meia-noite
      return de <= ate ? agora >= de && agora < ate : agora >= de || agora < ate;
    }
    case 'dias_semana': {
      const dias = Array.isArray(c.dias) ? c.dias.map(Number) : [];
      return dias.includes(horaLocal(ctx, avisos).dia);
    }
    case 'projeto':
      return evento.projeto !== undefined && igual(evento.projeto, c.projeto);
    case 'lista':
      return evento.lista !== undefined && igual(evento.lista, c.lista);
    case 'etiqueta': {
      const alvo = String(c.etiqueta ?? '')
        .replace(/^#/, '')
        .toLowerCase();
      return (
        Array.isArray(evento.etiquetas) &&
        evento.etiquetas.some((e) => String(e).toLowerCase() === alvo)
      );
    }
    case 'nivel_min': {
      const nivel = numero(ctx.usuario?.nivel);
      return nivel !== null && nivel >= Number(c.nivel);
    }
    default:
      avisos.push(`Condição pronta desconhecida: ${c.pronta}`);
      return false;
  }
}

function comparar(
  c: { campo: string; op: string; valor?: unknown },
  ctx: Contexto,
  avisos: string[],
): boolean {
  const caminho = c.campo.replace(/^\{\{|\}\}$/g, '').trim();
  const { achou, valor: a } = resolver(caminho, ctx);
  if (c.op === 'vazio') return vazio(a);
  if (!achou) avisos.push(`Variável inexistente: ${caminho}`);
  const b =
    typeof c.valor === 'string' && c.valor.includes('{{')
      ? expandir(c.valor, ctx, avisos)
      : c.valor;
  switch (c.op) {
    case '=':
      return achou && (Array.isArray(a) ? a.some((x) => igual(x, b)) : igual(a, b));
    case '≠':
      return !(achou && (Array.isArray(a) ? a.some((x) => igual(x, b)) : igual(a, b)));
    case '<':
    case '≤':
    case '>':
    case '≥': {
      if (!achou) return false;
      const na = numero(a);
      const nb = numero(b);
      let d: number;
      if (na !== null && nb !== null) d = na - nb;
      else if (
        typeof a === 'string' &&
        typeof b === 'string' &&
        /^\d{4}-\d{2}/.test(a) &&
        /^\d{4}-\d{2}/.test(b)
      ) {
        d = a < b ? -1 : a > b ? 1 : 0;
      } else {
        avisos.push(`Não dá para comparar "${comoTexto(a)}" ${c.op} "${comoTexto(b)}"`);
        return false;
      }
      return c.op === '<' ? d < 0 : c.op === '≤' ? d <= 0 : c.op === '>' ? d > 0 : d >= 0;
    }
    case 'contem':
      if (!achou) return false;
      return Array.isArray(a)
        ? a.some((x) => igual(x, b))
        : comoTexto(a).toLowerCase().includes(comoTexto(b).toLowerCase());
    case 'comeca_com':
      return achou && comoTexto(a).toLowerCase().startsWith(comoTexto(b).toLowerCase());
    case 'em': {
      if (!achou) return false;
      const lista = Array.isArray(b)
        ? b
        : comoTexto(b)
            .split(',')
            .map((x) => x.trim());
      return lista.some((x) => igual(a, x));
    }
    default:
      avisos.push(`Operador desconhecido: ${c.op}`);
      return false;
  }
}

/**
 * Avalia a condição, sem efeito nenhum. Erro de tipo ou nó demais viram "falsa" mais um aviso; nunca
 * interrompem a execução.
 */
export function avaliar(
  cond: Condicao | null | undefined,
  ctx: Contexto,
  avisos: string[],
): boolean {
  if (!cond) return true;
  const orcamento = { n: ORCAMENTO };
  const go = (c: Condicao): boolean => {
    if (--orcamento.n < 0) {
      if (orcamento.n === -1) avisos.push('Condição grande demais');
      return false;
    }
    if (!c || typeof c !== 'object') {
      avisos.push('Condição inválida');
      return false;
    }
    if ('e' in c) return Array.isArray(c.e) && c.e.every(go);
    if ('ou' in c) return Array.isArray(c.ou) && c.ou.some(go);
    if ('nao' in c) return !go(c.nao as Condicao);
    if ('pronta' in c) return pronta(c, ctx, avisos);
    if ('campo' in c && typeof c.campo === 'string') return comparar(c, ctx, avisos);
    avisos.push('Condição inválida');
    return false;
  };
  return go(cond);
}

// ---------------------------------------------------------------------------------------------
// Programa linear
// ---------------------------------------------------------------------------------------------

/** Instrução: um passo (com o destino de cada bloco e do fim) ou um salto. */
export type Instrucao =
  | { passo: Passo; caminho: string; blocos?: Record<string, number>; fim?: number }
  | { salto: number }
  | { condicoes: Condicao };

/**
 * Achata os passos: o passo com blocos vem seguido do corpo de cada bloco, e cada corpo termina num
 * salto para depois do último. Passo de tipo desconhecido entra como está (falha quando for a vez dele).
 */
export function compile(
  passos: Passo[],
  registro: Registro,
  condicoes?: Condicao | null,
): Instrucao[] {
  const out: Instrucao[] = condicoes ? [{ condicoes }] : [];
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
  emit(passos, '');
  return out;
}

/** Linha do histórico de um passo (automation_runs.steps). */
export type LinhaPasso = {
  resultado?: unknown;
  caminho: string;
  tipo: string;
  ok: boolean;
  erro?: string;
  ramo?: string | null;
};

export type Avanco = {
  /** Próximo ponteiro (igual a program.length: acabou). */
  proximo: number;
  estado: Estado;
  efeito?: Efeito;
  status: Situacao;
  erro?: string;
  avisos: string[];
  log?: LinhaPasso;
  /** Quando voltar (ISO), se a execução fica esperando. */
  volta?: string;
  /** O efeito é para fora do app: o executor faz antes de gravar o passo. */
  externo?: boolean;
};

/** O que o passo deixa a execução: segue, acabou, falhou, espera ou tenta de novo depois. */
export type Situacao = 'rodando' | 'ok' | 'falhou' | 'esperando' | 'tentar';

/** Um passo: puro. Saltos são seguidos sem virar passo. */
export function advance(
  programa: Instrucao[],
  pc: number,
  ctx: Contexto,
  registro: Registro,
): Avanco {
  let p = pc;
  while (p < programa.length) {
    const inst = programa[p];
    if (!('salto' in inst)) break;
    p = inst.salto;
  }
  if (p >= programa.length)
    return { proximo: programa.length, estado: ctx.estado, status: 'ok', avisos: [] };
  const atual = programa[p];
  if ('condicoes' in atual) {
    // As condições da regra: não batendo, a execução acaba sem fazer nada (e fica no histórico)
    const avisos: string[] = [];
    const ok = avaliar(atual.condicoes, ctx, avisos);
    const proximo = ok ? p + 1 : programa.length;
    return {
      proximo,
      estado: ctx.estado,
      status: proximo >= programa.length ? 'ok' : 'rodando',
      avisos,
      log: { caminho: 'condicoes', tipo: 'condicoes', ok: true, ramo: ok ? 'sim' : 'nao' },
    };
  }
  const inst = atual as Extract<Instrucao, { passo: Passo }>;
  const tipo = registro.get(inst.passo.tipo);
  const base = { caminho: inst.caminho, tipo: inst.passo.tipo };
  if (!tipo) {
    const erro = `Passo "${inst.passo.tipo}" ainda não está disponível`;
    return {
      proximo: p,
      estado: ctx.estado,
      status: 'falhou',
      erro,
      avisos: [],
      log: { ...base, ok: false, erro },
    };
  }
  let r: Resultado;
  try {
    r = tipo.execute(ctx, inst.passo);
  } catch (e) {
    r = { erro: e instanceof Error ? e.message : String(e) };
  }
  if (r.tentar) {
    return {
      proximo: p,
      estado: ctx.estado,
      status: 'tentar',
      erro: r.tentar,
      avisos: r.avisos ?? [],
    };
  }
  if (r.erro) {
    return {
      proximo: p,
      estado: ctx.estado,
      status: 'falhou',
      erro: r.erro,
      avisos: r.avisos ?? [],
      log: { ...base, ok: false, erro: r.erro },
    };
  }
  let estado: Estado = r.var ? { ...ctx.estado, var: { ...ctx.estado.var, ...r.var } } : ctx.estado;
  if (r.meta) {
    const meta = { ...(estado.meta ?? {}) };
    for (const [k, n] of Object.entries(r.meta)) meta[k] = (meta[k] ?? 0) + n;
    estado = { ...estado, meta };
  }
  let proximo = p + 1;
  if (inst.blocos)
    proximo = r.ramo && r.ramo in inst.blocos ? inst.blocos[r.ramo] : (inst.fim ?? p + 1);
  if (r.parar) proximo = programa.length;
  const log: LinhaPasso = inst.blocos
    ? { ...base, ok: true, ramo: r.ramo ?? null }
    : { ...base, ok: true };
  if (r.esperar && proximo < programa.length) {
    const volta = new Date(new Date(ctx.agora).getTime() + r.esperar * 60_000).toISOString();
    return {
      proximo,
      estado,
      efeito: r.efeito,
      ...(tipo.externo && r.efeito ? { externo: true } : {}),
      status: 'esperando',
      avisos: r.avisos ?? [],
      log,
      volta,
    };
  }
  return {
    proximo,
    estado,
    efeito: r.efeito,
    ...(tipo.externo && r.efeito ? { externo: true } : {}),
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
  definition: { passos?: Passo[]; condicoes?: Condicao | null };
  fuso?: string;
  idioma?: string;
  usuario?: Record<string, unknown>;
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
  status: Situacao;
  error: string | null;
  resume: string | null;
};

/** Grava o passo no banco. 'ignorado': outro executor já fez este passo (ou a execução mudou). */
export type CommitFn = (c: Commit) => Promise<'ok' | 'ignorado' | 'falhou'>;

/** Resultado de um efeito externo feito pelo executor. */
export type ResultadoExterno =
  { ok: true; resultado?: unknown } | { tentar: string } | { erro: string };

/** Faz o efeito externo (webhook, dispositivo). `chave` é a de idempotência: `<execução>:<passo>`. */
export type ExternoFn = (efeito: Efeito, chave: string, run: Execucao) => Promise<ResultadoExterno>;

export type OpcoesExecutor = {
  agora?: () => string;
  externo?: ExternoFn;
  /** Tempo ativo máximo de uma execução, sem contar esperas (V14 §6.4). */
  limiteMs?: number;
  relogio?: () => number;
};

/** Tempo ativo por execução (V14 §6.4). */
export const LIMITE_EXECUCAO_MS = 30_000;

/**
 * Roda uma execução do ponto em que parou até o fim, um commit por passo. O commit com efeito é
 * idempotente no banco: se o mesmo passo chegar duas vezes, o segundo é ignorado e o executor para.
 * Efeito externo é feito aqui antes do commit, com a chave `<execução>:<passo>` (quem recebe usa
 * para não repetir, se o executor cair entre a chamada e o commit).
 */
export async function executeRun(
  run: Execucao,
  registro: Registro,
  commit: CommitFn,
  opcoes: OpcoesExecutor | (() => string) = {},
): Promise<'ok' | 'falhou' | 'ignorado' | 'esperando' | 'tentar'> {
  const o: OpcoesExecutor = typeof opcoes === 'function' ? { agora: opcoes } : opcoes;
  const agora = o.agora ?? (() => new Date().toISOString());
  const relogio = o.relogio ?? (() => Date.now());
  const limite = o.limiteMs ?? LIMITE_EXECUCAO_MS;
  const inicio = relogio();
  const programa = compile(run.definition.passos ?? [], registro, run.definition.condicoes);
  let estado: Estado = {
    evento: run.state.evento ?? {},
    var: run.state.var ?? {},
    ...(run.state.meta ? { meta: run.state.meta } : {}),
  };
  let pc = run.step;
  for (let guarda = 0; guarda <= programa.length + 1; guarda++) {
    const base = { run: run.id, claim: run.claimed_at, step: pc, resume: null };
    if (relogio() - inicio > limite) {
      const error = `Passou de ${Math.round(limite / 1000)} s de execução`;
      const res = await commit({
        ...base,
        next: pc,
        state: estado,
        effect: null,
        log: null,
        warnings: [],
        status: 'falhou',
        error,
      });
      return res === 'ok' ? 'falhou' : res;
    }
    const ctx: Contexto = {
      estado,
      escopo: run.scope,
      regra: { id: run.rule_id, nome: run.rule_name },
      agora: agora(),
      fuso: run.fuso,
      idioma: run.idioma,
      usuario: run.usuario,
    };
    const a = advance(programa, pc, ctx, registro);
    let efeito = a.efeito ?? null;
    let log = a.log ?? null;
    let status = a.status;
    let erro = a.erro ?? null;
    if (a.externo && efeito) {
      const r: ResultadoExterno = o.externo
        ? await o.externo(efeito, `${run.id}:${pc}`, run).catch((e: unknown) => ({
            tentar: e instanceof Error ? e.message : String(e),
          }))
        : { erro: 'Este executor não faz efeitos externos' };
      efeito = null;
      if ('tentar' in r) {
        status = 'tentar';
        erro = r.tentar;
      } else if ('erro' in r) {
        status = 'falhou';
        erro = r.erro;
        if (log) log = { ...log, ok: false, erro: r.erro };
      } else if (log && r.resultado !== undefined) {
        log = { ...log, resultado: r.resultado };
      }
    }
    const res = await commit({
      ...base,
      next: status === 'tentar' ? pc : a.proximo,
      state: a.estado,
      effect: efeito,
      log,
      warnings: a.avisos,
      status,
      error: erro,
      resume: a.volta ?? null,
    });
    if (res !== 'ok') return res;
    if (status !== 'rodando') return status;
    estado = a.estado;
    pc = a.proximo;
  }
  return 'falhou';
}

/** Uma linha do Testar: o que o passo faria. */
export type LinhaSimulada = {
  caminho: string;
  tipo: string;
  efeito?: Efeito;
  externo?: boolean;
  ramo?: string | null;
  erro?: string;
  esperaria?: string;
  avisos: string[];
};

/**
 * Testar (V14 §6.5): roda a regra com um evento de exemplo sem efeito nenhum. Não chama o banco nem
 * a rede: só devolve o que cada passo faria (as esperas são puladas, com a hora em que voltaria).
 */
export function simulate(
  definition: { passos?: Passo[]; condicoes?: Condicao | null },
  ctx: Contexto,
  registro: Registro,
): { linhas: LinhaSimulada[]; fim: 'ok' | 'falhou' | 'condicoes' } {
  const programa = compile(definition.passos ?? [], registro, definition.condicoes);
  const linhas: LinhaSimulada[] = [];
  let estado = ctx.estado;
  let pc = 0;
  for (let i = 0; i < 200 && pc < programa.length; i++) {
    const a = advance(programa, pc, { ...ctx, estado }, registro);
    if (a.log) {
      linhas.push({
        caminho: a.log.caminho,
        tipo: a.log.tipo,
        ...(a.efeito ? { efeito: a.efeito } : {}),
        ...(a.externo ? { externo: true } : {}),
        ...(a.log.ramo !== undefined ? { ramo: a.log.ramo } : {}),
        ...(a.erro ? { erro: a.erro } : {}),
        ...(a.volta ? { esperaria: a.volta } : {}),
        avisos: a.avisos,
      });
      if (a.log.tipo === 'condicoes' && a.log.ramo === 'nao') return { linhas, fim: 'condicoes' };
    }
    if (a.status === 'falhou' || a.status === 'tentar') return { linhas, fim: 'falhou' };
    estado = a.estado;
    pc = a.proximo;
  }
  return { linhas, fim: 'ok' };
}

// ---------------------------------------------------------------------------------------------
// Tipos de passo (comandar_dispositivo chega no SL3)
// ---------------------------------------------------------------------------------------------

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto do passo com `{{ }}` expandido (só texto; o resto vira vazio). */
const txt = (v: unknown, ctx: Contexto, avisos: string[]) =>
  typeof v === 'string' ? expandir(v, ctx, avisos).trim() : '';

/** Id escrito no passo ou vindo de uma variável (`{{evento.lista}}`); vazio se não for um id. */
const idDe = (v: unknown, ctx: Contexto, avisos: string[]) => {
  const out = txt(v, ctx, avisos);
  return UUID.test(out) ? out : undefined;
};

/** Hoje no fuso da dona, AAAA-MM-DD. */
export function hojeNoFuso(ctx: Contexto): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: ctx.fuso ?? 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ctx.agora));
  } catch {
    return ctx.agora.slice(0, 10);
  }
}

/** Vencimento: `AAAA-MM-DD`, `+N` (dias a partir de hoje, no fuso da dona), null (tirar) ou nada. */
export function vencimentoDe(
  v: unknown,
  ctx: Contexto,
  avisos: string[],
): string | null | undefined {
  if (v === null) return null;
  const out = txt(v, ctx, avisos);
  if (!out) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  const m = /^\+\s*(\d{1,3})\s*(d|dia|dias|day|days|día|días)?$/i.exec(out);
  if (m) {
    const d = new Date(`${hojeNoFuso(ctx)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Number(m[1]));
    return d.toISOString().slice(0, 10);
  }
  avisos.push(`Vencimento não entendido: ${out}`);
  return undefined;
}

const etiquetas = (v: unknown, ctx: Contexto, avisos: string[]) =>
  (Array.isArray(v) ? v : [])
    .map((x) => txt(x, ctx, avisos).replace(/^#/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

/** Limites por execução (V14 §5). */
export const MAX_TAREFAS_POR_EXECUCAO = 20;
export const MAX_VARIAVEIS = 20;

export const PASSOS_BASE: TipoPasso[] = [
  {
    id: 'notificar',
    execute: (ctx, p) => {
      const avisos: string[] = [];
      const titulo = expandir(texto(p.titulo, 2000), ctx, avisos).slice(0, 80);
      const corpo = expandir(texto(p.corpo, 2000), ctx, avisos).slice(0, 240);
      if (!titulo && !corpo) return { erro: 'O aviso precisa de título ou texto' };
      const canal = p.canal === 'app' || p.canal === 'push' ? p.canal : 'ambos';
      const para =
        ctx.escopo === 'pessoal'
          ? 'dona'
          : p.para === 'responsaveis' || p.para === 'pessoa'
            ? p.para
            : 'dona';
      return {
        avisos,
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
  {
    id: 'esperar',
    execute: (_ctx, p) => {
      const minutos = Math.round(Number(p.minutos));
      if (!Number.isFinite(minutos) || minutos < 1 || minutos > 10080) {
        return { erro: 'Esperar de 1 minuto a 7 dias' };
      }
      return { esperar: minutos };
    },
  },
  {
    id: 'se',
    blocos: ['entao', 'senao'],
    execute: (ctx, p) => {
      const avisos: string[] = [];
      return { ramo: avaliar(p.condicao as Condicao, ctx, avisos) ? 'entao' : 'senao', avisos };
    },
  },
  {
    id: 'criar_tarefa',
    execute: (ctx, p) => {
      if ((ctx.estado.meta?.tarefas ?? 0) >= MAX_TAREFAS_POR_EXECUCAO) {
        return { erro: `No máximo ${MAX_TAREFAS_POR_EXECUCAO} tarefas criadas por execução` };
      }
      const avisos: string[] = [];
      const titulo = txt(p.titulo, ctx, avisos).slice(0, 500);
      if (!titulo) return { erro: 'A tarefa precisa de título', avisos };
      const vencimento = vencimentoDe(p.vencimento, ctx, avisos);
      const lista = idDe(p.lista, ctx, avisos);
      const tags = etiquetas(p.etiquetas, ctx, avisos);
      return {
        avisos,
        meta: { tarefas: 1 },
        efeito: {
          tipo: 'criar_tarefa',
          titulo,
          ...(lista ? { lista } : {}),
          ...(vencimento ? { vencimento } : {}),
          ...(tags.length ? { etiquetas: tags } : {}),
          ...(p.evitar_duplicar === true ? { evitar_duplicar: true } : {}),
        },
      };
    },
  },
  {
    id: 'atualizar_tarefa',
    // Só estas chaves saem no efeito: concluir, reabrir e apagar não existem (V14-5)
    execute: (ctx, p) => {
      const avisos: string[] = [];
      const doEvento = p.tarefa === undefined || p.tarefa === 'evento';
      const tarefa = doEvento ? undefined : idDe(p.tarefa, ctx, avisos);
      if (!doEvento && !tarefa) return { erro: 'Tarefa não encontrada', avisos };
      const add = etiquetas(p.adicionar_etiquetas, ctx, avisos);
      const del = etiquetas(p.remover_etiquetas, ctx, avisos);
      const mover = idDe(p.mover_para, ctx, avisos);
      const vencimento = 'vencimento' in p ? vencimentoDe(p.vencimento, ctx, avisos) : undefined;
      return {
        avisos,
        efeito: {
          tipo: 'atualizar_tarefa',
          ...(tarefa ? { tarefa } : {}),
          ...(add.length ? { adicionar_etiquetas: add } : {}),
          ...(del.length ? { remover_etiquetas: del } : {}),
          ...(mover ? { mover_para: mover } : {}),
          ...(vencimento !== undefined ? { vencimento } : {}),
        },
      };
    },
  },
  {
    id: 'atribuir',
    execute: (ctx, p) => {
      const avisos: string[] = [];
      const pessoa = idDe(p.pessoa, ctx, avisos);
      if (!pessoa) return { erro: 'Escolha a pessoa', avisos };
      const doEvento = p.tarefa === undefined || p.tarefa === 'evento';
      const tarefa = doEvento ? undefined : idDe(p.tarefa, ctx, avisos);
      return { avisos, efeito: { tipo: 'atribuir', pessoa, ...(tarefa ? { tarefa } : {}) } };
    },
  },
  {
    id: 'descanso',
    execute: (_ctx, p) => {
      const n = Math.round(Number(p.segundos ?? 60));
      return {
        efeito: {
          tipo: 'descanso',
          segundos: Number.isFinite(n) ? Math.min(Math.max(n, 5), 3600) : 60,
        },
      };
    },
  },
  {
    id: 'definir_variavel',
    execute: (ctx, p) => {
      const nome = String(p.nome ?? '');
      if (!/^[a-z_][a-z0-9_]{0,30}$/.test(nome)) return { erro: 'Nome de variável inválido' };
      if (!(nome in ctx.estado.var) && Object.keys(ctx.estado.var).length >= MAX_VARIAVEIS) {
        return { erro: `No máximo ${MAX_VARIAVEIS} variáveis por execução` };
      }
      const avisos: string[] = [];
      const bruto = typeof p.valor === 'string' ? expandir(p.valor, ctx, avisos) : p.valor;
      const valor =
        typeof bruto === 'string' && bruto.trim() !== '' && Number.isFinite(Number(bruto))
          ? Number(bruto)
          : bruto;
      return { avisos, var: { [nome]: valor ?? '' } };
    },
  },
  {
    id: 'executar_regra',
    execute: (ctx, p) => {
      const avisos: string[] = [];
      const regra = idDe(p.regra, ctx, avisos);
      if (!regra) return { erro: 'Escolha a automação', avisos };
      // A cadeia de quem chamou também é conferida no banco (sem ciclo, até 3)
      const cadeia = Array.isArray(ctx.estado.evento._cadeia)
        ? ctx.estado.evento._cadeia.map(String)
        : [];
      if (regra === ctx.regra.id || cadeia.includes(regra))
        return { erro: 'Automação chamando a si mesma em círculo' };
      if (cadeia.length + 1 >= 3) return { erro: 'No máximo 3 automações em sequência' };
      return { avisos, efeito: { tipo: 'executar_regra', regra } };
    },
  },
  {
    id: 'enviar_webhook',
    externo: true,
    // O corpo é um objeto JSON: cada texto é expandido e o JSON.stringify faz o escape (V14 §2.1)
    execute: (ctx, p) => {
      const avisos: string[] = [];
      const url = txt(p.url, ctx, avisos);
      if (!/^https:\/\//i.test(url)) return { erro: 'Só endereços https://', avisos };
      const metodo = String(p.metodo ?? 'POST').toUpperCase();
      const cabecalhos: Record<string, string | { segredo: string }> = {};
      if (p.cabecalhos && typeof p.cabecalhos === 'object' && !Array.isArray(p.cabecalhos)) {
        for (const [k, v] of Object.entries(p.cabecalhos as Record<string, unknown>)) {
          if (typeof v === 'string') cabecalhos[k] = txt(v, ctx, avisos);
          else if (
            v &&
            typeof v === 'object' &&
            typeof (v as { segredo?: unknown }).segredo === 'string'
          ) {
            cabecalhos[k] = { segredo: (v as { segredo: string }).segredo };
          }
        }
      }
      const expandeTudo = (v: unknown, nivel: number): unknown => {
        if (nivel > 5) return null;
        if (typeof v === 'string') return expandir(v, ctx, avisos);
        if (Array.isArray(v)) return v.map((x) => expandeTudo(x, nivel + 1));
        if (v && typeof v === 'object') {
          return Object.fromEntries(
            Object.entries(v as Record<string, unknown>).map(([k, x]) => [
              k,
              expandeTudo(x, nivel + 1),
            ]),
          );
        }
        return v;
      };
      const corpo =
        p.corpo === undefined || p.corpo === null ? null : JSON.stringify(expandeTudo(p.corpo, 0));
      if (corpo !== null && corpo.length > 16_384)
        return { erro: 'Corpo do webhook com mais de 16 KB', avisos };
      return {
        avisos,
        efeito: {
          tipo: 'webhook',
          url,
          metodo,
          cabecalhos,
          corpo,
          ...(p.assinar === true ? { assinar: true } : {}),
        },
      };
    },
  },
  {
    id: 'alternar_modo_jogo',
    execute: (_ctx, p) =>
      p.modo === 'off' || p.modo === 'light' || p.modo === 'full'
        ? { efeito: { tipo: 'alternar_modo_jogo', modo: p.modo } }
        : { erro: 'Modo de jogo: off, light ou full' },
  },
];

export const registroBase = () => createRegistry(PASSOS_BASE);
