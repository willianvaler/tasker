// Visão Fluxo (V3 §2.6): o grafo do projeto a partir das tarefas e dos pré-requisitos. Funções
// puras (com teste): quem entra no grafo, a etapa (coluna) de cada tarefa, a fronteira ativa
// ("você está aqui"), o caminho crítico pelas estimativas e as raias por pessoa. O desenho (dagre e
// React Flow) fica em components/project-flow.

import { taskState, type StateDep, type StateTask, type TaskState } from './task-state';

export type FlowTask = StateTask & {
  title: string;
  page_id: string;
  estimate_minutes: number | null;
};
export type FlowDep = StateDep & { id: string };
export type FlowPerson = { userId: string | null; name: string };

export type FlowNode = {
  id: string;
  title: string;
  state: TaskState;
  waitingOn: string[];
  readyAt?: string;
  /** Etapa: 0 para quem não espera ninguém, depois o caminho mais longo até ela */
  rank: number;
  people: FlowPerson[];
  /** Raia: o primeiro responsável ('' sem responsável) */
  lane: string;
  /** Na fronteira ativa: pronta ou em andamento */
  frontier: boolean;
  /** Na fronteira e é minha */
  mine: boolean;
  critical: boolean;
  estimate: number | null;
};
export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  lag: number;
  /** O pré-requisito já está atendido */
  met: boolean;
  critical: boolean;
};
export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Caminho crítico do que falta (minutos e quantas tarefas), quando há estimativas */
  critical: { minutes: number; count: number } | null;
  /** Concluídas escondidas (galhos já terminados) */
  hiddenDone: number;
};

export function buildFlow({
  tasks,
  deps,
  people,
  me,
  hideDone = true,
  now = new Date(),
  blockedPages,
}: {
  tasks: ReadonlyMap<string, FlowTask>;
  deps: readonly FlowDep[];
  people: ReadonlyMap<string, FlowPerson[]>;
  me?: string;
  hideDone?: boolean;
  now?: Date;
  /** Listas que esperam outra lista (lib/page-deps.ts) */
  blockedPages?: ReadonlySet<string>;
}): FlowGraph {
  // Só as ligações entre tarefas que existem; as tarefas ligadas entram no grafo
  const links = deps.filter((d) => tasks.has(d.task_id) && tasks.has(d.depends_on_task_id));
  const ids = new Set(links.flatMap((d) => [d.task_id, d.depends_on_task_id]));
  const preds = new Map<string, FlowDep[]>();
  const succs = new Map<string, FlowDep[]>();
  for (const d of links) {
    preds.set(d.task_id, [...(preds.get(d.task_id) ?? []), d]);
    succs.set(d.depends_on_task_id, [...(succs.get(d.depends_on_task_id) ?? []), d]);
  }

  const state = new Map([...ids].map((id) => [id, taskState(id, tasks, deps, now, blockedPages)]));

  // Etapa: caminho mais longo desde as tarefas sem pré-requisito (o banco não deixa ciclo; a
  // guarda só evita laço se um dado antigo tiver um)
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const rankOf = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const r = Math.max(-1, ...(preds.get(id) ?? []).map((d) => rankOf(d.depends_on_task_id))) + 1;
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  for (const id of ids) rankOf(id);

  // Caminho crítico do que falta: soma das estimativas das abertas mais os atrasos pendentes
  const weight = (id: string) => {
    const t = tasks.get(id);
    return !t || t.status === 'done' ? 0 : (t.estimate_minutes ?? 0);
  };
  const hasEstimates = [...ids].some((id) => weight(id) > 0);
  const dist = new Map<string, number>();
  const via = new Map<string, FlowDep | undefined>();
  const order = [...ids].sort((a, b) => rank.get(a)! - rank.get(b)!);
  for (const id of order) {
    let best = 0;
    let from: FlowDep | undefined;
    for (const d of preds.get(id) ?? []) {
      const met = state.get(id)?.waitingOn.includes(d.depends_on_task_id) === false;
      const value = (dist.get(d.depends_on_task_id) ?? 0) + (met ? 0 : d.lag_minutes);
      if (value > best) {
        best = value;
        from = d;
      }
    }
    dist.set(id, best + weight(id));
    via.set(id, from);
  }
  const criticalIds = new Set<string>();
  const criticalEdges = new Set<string>();
  let critical: FlowGraph['critical'] = null;
  if (hasEstimates) {
    let end = order[0];
    for (const id of order) if ((dist.get(id) ?? 0) > (dist.get(end) ?? 0)) end = id;
    for (let at: string | undefined = end; at;) {
      criticalIds.add(at);
      const d = via.get(at);
      if (d) criticalEdges.add(d.id);
      at = d?.depends_on_task_id;
    }
    // Só o que falta conta: o trecho já concluído no começo do caminho não é crítico
    for (const id of [...criticalIds]) if (tasks.get(id)?.status === 'done') criticalIds.delete(id);
    critical = {
      minutes: dist.get(end) ?? 0,
      count: criticalIds.size,
    };
  }

  // Galhos concluídos: a concluída some quando ninguém aberto depende dela
  const hidden = new Set<string>();
  if (hideDone)
    for (const id of ids) {
      if (tasks.get(id)?.status !== 'done') continue;
      const next = succs.get(id) ?? [];
      if (next.every((d) => tasks.get(d.task_id)?.status === 'done')) hidden.add(id);
    }

  const nodes: FlowNode[] = [...ids]
    .filter((id) => !hidden.has(id))
    .map((id) => {
      const task = tasks.get(id)!;
      const s = state.get(id)!;
      const who = people.get(id) ?? [];
      const frontier = s.state === 'ready' || s.state === 'doing';
      return {
        id,
        title: task.title,
        state: s.state,
        waitingOn: s.waitingOn,
        ...(s.readyAt ? { readyAt: s.readyAt } : {}),
        rank: rank.get(id) ?? 0,
        people: who,
        lane: who[0]?.name ?? '',
        frontier,
        mine: frontier && !!me && who.some((p) => p.userId === me),
        critical: criticalIds.has(id),
        estimate: task.estimate_minutes,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));

  const edges: FlowEdge[] = links
    .filter((d) => !hidden.has(d.task_id) && !hidden.has(d.depends_on_task_id))
    .map((d) => ({
      id: d.id,
      source: d.depends_on_task_id,
      target: d.task_id,
      lag: d.lag_minutes,
      met: state.get(d.task_id)?.waitingOn.includes(d.depends_on_task_id) === false,
      critical: criticalEdges.has(d.id),
    }));

  return { nodes, edges, critical, hiddenDone: hidden.size };
}

/** Raias em ordem: a minha primeiro, depois por nome, e "sem responsável" no fim. */
export function laneOrder(nodes: readonly FlowNode[], myName?: string) {
  const names = [...new Set(nodes.map((n) => n.lane))];
  return names.sort((a, b) => {
    if (a === b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    if (myName && a === myName) return -1;
    if (myName && b === myName) return 1;
    return a.localeCompare(b);
  });
}

/** Etapas para a lista acessível: as tarefas agrupadas pela coluna do grafo. */
export function flowSteps(nodes: readonly FlowNode[]) {
  const steps = new Map<number, FlowNode[]>();
  for (const n of nodes) steps.set(n.rank, [...(steps.get(n.rank) ?? []), n]);
  return [...steps.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
}
