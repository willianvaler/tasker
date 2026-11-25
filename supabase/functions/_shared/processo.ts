// Processos, o BPM leve (ESCOPO_V16 Parte B, PR2 a PR4, D349): o vocabulário de nós, a validação do
// grafo e o passo do motor. Sem imports: roda no app (editor, simulação) e no Deno (executor). A
// linguagem de expressões (FN0, _shared/expr.ts) entra por parâmetro, porque o Node e o Deno não
// importam do mesmo jeito.
//
// Grafo: { v: 1, nos: [...], arestas: [...], variaveis: [...], opcoes: {...} }. Um token anda pelos
// nós; portão paralelo divide em vários tokens e junta quando todos chegam. Tudo o que um passo
// automático faz é uma ação do registro do V14 (efeito aplicado pelo banco ou pelo executor).

export type TipoNo =
  | 'inicio'
  | 'fim'
  | 'servico'
  | 'humana'
  | 'xor'
  | 'and'
  | 'temporizador'
  | 'mensagem'
  | 'subprocesso'
  | 'laco'
  | 'multi';

export const TIPOS_NO: TipoNo[] = [
  'inicio',
  'fim',
  'servico',
  'humana',
  'xor',
  'and',
  'temporizador',
  'mensagem',
  'subprocesso',
  'laco',
  'multi',
];

export type No = {
  id: string;
  tipo: TipoNo;
  nome?: string;
  x?: number;
  y?: number;
  [chave: string]: unknown;
};

export type Aresta = {
  id: string;
  de: string;
  para: string;
  /** XOR: condição (expressão); a aresta `padrao` não tem */
  condicao?: string;
  padrao?: boolean;
  /** Caminho de erro de uma tarefa de serviço */
  erro?: boolean;
  /** Tarefa humana com escolhas: qual escolha leva por aqui */
  escolha?: string;
  /** Laço: 'repetir' ou 'sair' */
  laco?: 'repetir' | 'sair';
  /** Temporizador de limite numa tarefa humana ou mensagem: o caminho quando vence */
  prazo?: boolean;
};

export type Variavel = { nome: string; tipo: 'texto' | 'numero' | 'booleano' | 'data' | 'lista' | 'objeto' };

export type Grafo = {
  v: 1;
  nos: No[];
  arestas: Aresta[];
  variaveis?: Variavel[];
  /** Função (FN): o que entra e o que sai */
  assinatura?: { entradas: Variavel[]; saidas: Variavel[] };
  opcoes?: { xp_humana?: boolean; reatribuir?: 'grupo' | 'dona' };
};

// ---------------------------------------------------------------------------------------------
// Limites (PR4, V16-17)
// ---------------------------------------------------------------------------------------------

export const LIMITES = {
  nos: 200,
  passosPorInstancia: 2000,
  diasPorInstancia: 365,
  instanciasAtivasPorPessoa: 500,
  iniciosPorHora: 60,
  variaveisBytes: 32 * 1024,
  profundidade: 5,
  falhasSeguidas: 5,
  laco: 50,
  multi: 100,
  avisoNos: 100,
};

// ---------------------------------------------------------------------------------------------
// Expressões (injetadas)
// ---------------------------------------------------------------------------------------------

export type ExprApi = {
  /** Erro de escrita da expressão, ou null */
  erro: (texto: string) => string | null;
  /** Os campos `{…}` que a expressão lê */
  campos: (texto: string) => string[];
  avaliar: (
    texto: string,
    vars: Record<string, unknown>,
    quando: { today: string; now?: string },
  ) => { ok: true; value: unknown } | { ok: false; error: { code: string; name?: string } };
};

/** Textos de expressão do nó (condição, entradas, prazo, lista, chave). */
function expressoesDoNo(no: No): string[] {
  const out: string[] = [];
  const add = (v: unknown) => typeof v === 'string' && v.trim() && out.push(v);
  if (no.entradas && typeof no.entradas === 'object') Object.values(no.entradas as Record<string, unknown>).forEach(add);
  if (no.tipo === 'laco') add(no.condicao);
  if (no.tipo === 'multi') add(no.lista);
  if (no.tipo === 'mensagem') add(no.chave);
  if (no.tipo === 'temporizador') add(no.ate);
  const resp = no.responsavel as { tipo?: string; valor?: unknown } | undefined;
  if (no.tipo === 'humana' && resp?.tipo === 'expressao') add(resp.valor);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Validação (PR2): ao salvar e ao publicar. Cada erro aponta o nó (ou a aresta).
// ---------------------------------------------------------------------------------------------

export type ErroGrafo = { codigo: string; no?: string; aresta?: string; detalhe?: string };

const DURACAO = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/;

/** Duração ISO (`PT2H`, `P1DT30M`) em minutos; null se não for uma. */
export function duracaoMin(texto: unknown): number | null {
  if (typeof texto !== 'string') return null;
  const m = DURACAO.exec(texto.trim());
  if (!m || texto.trim() === 'P' || texto.trim() === 'PT') return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function validarGrafo(g: Grafo, expr: ExprApi, passosPermitidos: readonly string[]): ErroGrafo[] {
  const erros: ErroGrafo[] = [];
  const nos = Array.isArray(g?.nos) ? g.nos : [];
  const arestas = Array.isArray(g?.arestas) ? g.arestas : [];
  if (nos.length > LIMITES.nos) erros.push({ codigo: 'muitos_nos', detalhe: String(nos.length) });
  const porId = new Map<string, No>();
  for (const n of nos) {
    if (!n?.id || porId.has(n.id)) erros.push({ codigo: 'id_repetido', no: n?.id });
    else porId.set(n.id, n);
    if (!TIPOS_NO.includes(n?.tipo)) erros.push({ codigo: 'tipo_desconhecido', no: n?.id, detalhe: String(n?.tipo) });
  }
  const inicios = nos.filter((n) => n.tipo === 'inicio');
  if (inicios.length === 0) erros.push({ codigo: 'sem_inicio' });
  if (inicios.length > 1) for (const n of inicios.slice(1)) erros.push({ codigo: 'dois_inicios', no: n.id });
  if (!nos.some((n) => n.tipo === 'fim')) erros.push({ codigo: 'sem_fim' });
  const saem = new Map<string, Aresta[]>();
  const entram = new Map<string, Aresta[]>();
  for (const a of arestas) {
    if (!porId.has(a.de) || !porId.has(a.para)) {
      erros.push({ codigo: 'aresta_solta', aresta: a.id });
      continue;
    }
    saem.set(a.de, [...(saem.get(a.de) ?? []), a]);
    entram.set(a.para, [...(entram.get(a.para) ?? []), a]);
  }
  if (erros.some((e) => e.codigo === 'sem_inicio' || e.codigo === 'aresta_solta')) return erros;

  // Alcançável a partir do início; e todo nó chega a um fim (laço sem saída não chega)
  const alcanca = (de: string[], viz: (id: string) => string[]) => {
    const vistos = new Set(de);
    const fila = [...de];
    while (fila.length) for (const p of viz(fila.shift() as string)) if (!vistos.has(p)) (vistos.add(p), fila.push(p));
    return vistos;
  };
  const doInicio = alcanca([inicios[0].id], (id) => (saem.get(id) ?? []).map((a) => a.para));
  const fins = nos.filter((n) => n.tipo === 'fim').map((n) => n.id);
  const chegaAoFim = alcanca(fins, (id) => (entram.get(id) ?? []).map((a) => a.de));
  for (const n of nos) {
    if (!doInicio.has(n.id)) erros.push({ codigo: 'inalcancavel', no: n.id });
    else if (!chegaAoFim.has(n.id)) erros.push({ codigo: 'sem_saida', no: n.id });
  }

  for (const n of nos) {
    const out = saem.get(n.id) ?? [];
    const inn = entram.get(n.id) ?? [];
    if (n.tipo === 'inicio' && inn.length) erros.push({ codigo: 'entra_no_inicio', no: n.id });
    if (n.tipo === 'fim' && out.length) erros.push({ codigo: 'sai_do_fim', no: n.id });
    if (n.tipo !== 'fim' && out.length === 0) erros.push({ codigo: 'sem_continuacao', no: n.id });
    if (n.tipo === 'xor') {
      if (out.length < 2) erros.push({ codigo: 'xor_poucos_caminhos', no: n.id });
      const padrao = out.filter((a) => a.padrao);
      if (padrao.length !== 1) erros.push({ codigo: 'xor_sem_padrao', no: n.id });
      for (const a of out.filter((x) => !x.padrao)) {
        if (!a.condicao?.trim()) erros.push({ codigo: 'xor_sem_condicao', no: n.id, aresta: a.id });
        else {
          const e = expr.erro(a.condicao);
          if (e) erros.push({ codigo: 'expressao', no: n.id, aresta: a.id, detalhe: e });
        }
      }
    }
    if (n.tipo === 'laco') {
      const max = Number(n.max ?? 0);
      if (!Number.isInteger(max) || max < 1 || max > LIMITES.laco) erros.push({ codigo: 'laco_max', no: n.id });
      if (out.filter((a) => a.laco === 'repetir').length !== 1 || out.filter((a) => a.laco === 'sair').length !== 1) {
        erros.push({ codigo: 'laco_caminhos', no: n.id });
      }
    }
    if (n.tipo === 'servico') {
      const acao = n.acao as { tipo?: string } | undefined;
      if (!acao?.tipo || !passosPermitidos.includes(acao.tipo)) erros.push({ codigo: 'acao_desconhecida', no: n.id, detalhe: acao?.tipo });
      if (out.filter((a) => a.erro).length > 1) erros.push({ codigo: 'dois_caminhos_de_erro', no: n.id });
    }
    if (n.tipo === 'humana') {
      if (!String(n.titulo ?? '').trim()) erros.push({ codigo: 'humana_sem_titulo', no: n.id });
      const escolhas = Array.isArray(n.escolhas) ? (n.escolhas as string[]) : [];
      for (const a of out.filter((x) => x.escolha)) {
        if (!escolhas.includes(a.escolha as string)) erros.push({ codigo: 'escolha_desconhecida', no: n.id, aresta: a.id });
      }
      if (n.prazo !== undefined && duracaoMin(n.prazo) === null) erros.push({ codigo: 'prazo_invalido', no: n.id });
    }
    if (n.tipo === 'temporizador' && duracaoMin(n.duracao) === null && !String(n.ate ?? '').trim()) {
      erros.push({ codigo: 'temporizador_sem_tempo', no: n.id });
    }
    if (n.tipo === 'subprocesso' || n.tipo === 'multi') {
      if (typeof n.funcao !== 'string' || !/^[0-9a-f-]{36}$/.test(n.funcao)) erros.push({ codigo: 'sem_funcao', no: n.id });
      if (n.tipo === 'multi') {
        const max = Number(n.max ?? LIMITES.multi);
        if (!Number.isInteger(max) || max < 1 || max > LIMITES.multi) erros.push({ codigo: 'multi_max', no: n.id });
      }
    }
    for (const t of expressoesDoNo(n)) {
      const e = expr.erro(t);
      if (e) erros.push({ codigo: 'expressao', no: n.id, detalhe: e });
    }
  }

  // Paralelo balanceado: cada divisão tem uma junção que todos os ramos alcançam
  const junta = (id: string) => (entram.get(id) ?? []).length >= 2;
  for (const n of nos.filter((x) => x.tipo === 'and' && (saem.get(x.id) ?? []).length >= 2)) {
    const ramos = (saem.get(n.id) ?? []).map((a) =>
      alcanca([a.para], (id) => (saem.get(id) ?? []).map((x) => x.para)),
    );
    const comum = nos.find((x) => x.tipo === 'and' && x.id !== n.id && junta(x.id) && ramos.every((r) => r.has(x.id)));
    if (!comum) erros.push({ codigo: 'and_sem_juncao', no: n.id });
  }
  for (const n of nos.filter((x) => x.tipo === 'and' && junta(x.id))) {
    if ((saem.get(n.id) ?? []).length !== 1 && (entram.get(n.id) ?? []).length >= 2 && (saem.get(n.id) ?? []).length > 1) {
      erros.push({ codigo: 'and_junta_e_divide', no: n.id });
    }
  }

  // Variáveis: toda `{var.x}` precisa ser declarada (ou produzida por uma saída ou formulário)
  const declaradas = new Set<string>([
    ...(g.variaveis ?? []).map((v) => v.nome),
    ...(g.assinatura?.entradas ?? []).map((v) => v.nome),
  ]);
  for (const n of nos) {
    if (n.saidas && typeof n.saidas === 'object') for (const k of Object.keys(n.saidas as object)) declaradas.add(k);
    if (Array.isArray(n.formulario)) for (const c of n.formulario as { nome?: string }[]) if (c.nome) declaradas.add(c.nome);
  }
  const usadas = (texto: string) => expr.campos(texto).filter((c) => c.startsWith('var.')).map((c) => c.slice(4).split('.')[0]);
  for (const n of nos) {
    for (const t of expressoesDoNo(n)) {
      for (const v of usadas(t)) if (!declaradas.has(v)) erros.push({ codigo: 'variavel_nao_declarada', no: n.id, detalhe: v });
    }
  }
  for (const a of arestas) {
    if (!a.condicao) continue;
    for (const v of usadas(a.condicao)) if (!declaradas.has(v)) erros.push({ codigo: 'variavel_nao_declarada', aresta: a.id, detalhe: v });
  }
  return erros;
}

// ---------------------------------------------------------------------------------------------
// Motor (PR4): o passo de um token num nó. Puro: dado o grafo, o nó, as variáveis e o escopo do
// token, diz o que fazer. Quem grava (avanço, histórico, efeito, espera) é o banco, numa transação.
// ---------------------------------------------------------------------------------------------

export type Escopo = { laco?: Record<string, number>; [chave: string]: unknown };

export type Proximo = { no: string; escopo?: Escopo };

export type Decisao =
  | { tipo: 'seguir'; proximos: Proximo[]; vars?: Record<string, unknown>; efeito?: Record<string, unknown> & { tipo: string }; externo?: boolean }
  /** Espera (temporizador, mensagem, tarefa humana, subprocesso): o banco grava `process_waits` */
  | { tipo: 'esperar'; espera: Record<string, unknown> & { tipo: string }; vars?: Record<string, unknown> }
  /** Portão paralelo de junção: o banco conta quantos chegaram */
  | { tipo: 'juntar'; no: string; esperados: number; seguir: Proximo[] }
  | { tipo: 'fim'; erro?: string }
  | { tipo: 'falha'; erro: string };

export type Contexto = {
  vars: Record<string, unknown>;
  inicio: Record<string, unknown>;
  pagina?: Record<string, unknown>;
  hoje: string;
  agora: string;
  /** O resultado da espera que acabou (tarefa humana concluída, mensagem, subprocesso) */
  retorno?: Record<string, unknown>;
};

const espacos = (c: Contexto) => ({ var: c.vars, inicio: c.inicio, pagina: c.pagina ?? {}, retorno: c.retorno ?? {} });

export function avancar(g: Grafo, noId: string, escopo: Escopo, c: Contexto, expr: ExprApi): Decisao {
  const no = g.nos.find((n) => n.id === noId);
  if (!no) return { tipo: 'falha', erro: `Nó ${noId} não existe nesta versão` };
  const saem = g.arestas.filter((a) => a.de === no.id);
  const normais = saem.filter((a) => !a.erro && !a.prazo);
  const ir = (a: Aresta[], esc: Escopo = escopo): Proximo[] => a.map((x) => ({ no: x.para, escopo: esc }));
  const calcular = (texto: string) => {
    const r = expr.avaliar(texto, espacos(c), { today: c.hoje, now: c.agora });
    if (!r.ok) throw new Error(`Expressão "${texto}": ${r.error.code}${r.error.name ? ` (${r.error.name})` : ''}`);
    return r.value;
  };
  const entradas = () => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((no.entradas as Record<string, string>) ?? {})) out[k] = calcular(v);
    return out;
  };
  const verdade = (v: unknown) => v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v !== '') || (Array.isArray(v) && v.length > 0);
  try {
    switch (no.tipo) {
      case 'inicio':
        return { tipo: 'seguir', proximos: ir(normais) };
      case 'fim':
        return { tipo: 'fim', ...(no.erro === true ? { erro: String(no.mensagem ?? 'Fim com erro') } : {}) };
      case 'servico': {
        const acao = { ...(no.acao as Record<string, unknown> & { tipo: string }) };
        // As entradas do nó viram variáveis da ação ({{var.x}} nos textos da ação também valem)
        const vars = entradas();
        return { tipo: 'seguir', proximos: ir(normais), vars, efeito: acao };
      }
      case 'xor': {
        for (const a of saem.filter((x) => !x.padrao)) if (a.condicao && verdade(calcular(a.condicao))) return { tipo: 'seguir', proximos: ir([a]) };
        return { tipo: 'seguir', proximos: ir(saem.filter((x) => x.padrao)) };
      }
      case 'and': {
        const chegam = g.arestas.filter((a) => a.para === no.id).length;
        if (chegam >= 2) return { tipo: 'juntar', no: no.id, esperados: chegam, seguir: ir(normais) };
        return { tipo: 'seguir', proximos: ir(normais) };
      }
      case 'laco': {
        const voltas = { ...(escopo.laco ?? {}) };
        const n = (voltas[no.id] ?? 0) + 1;
        voltas[no.id] = n;
        const sair = verdade(calcular(String(no.condicao ?? '1'))) || n > Number(no.max ?? 1);
        const caminho = saem.filter((a) => a.laco === (sair ? 'sair' : 'repetir'));
        if (sair) delete voltas[no.id];
        return { tipo: 'seguir', proximos: ir(caminho, { ...escopo, laco: voltas }) };
      }
      case 'temporizador': {
        const min = duracaoMin(no.duracao);
        const ate = min !== null ? new Date(Date.parse(c.agora) + min * 60_000).toISOString() : String(calcular(String(no.ate)));
        return { tipo: 'esperar', espera: { tipo: 'temporizador', ate } };
      }
      case 'mensagem': {
        const chave = String(calcular(String(no.chave ?? '""')));
        const limite = duracaoMin(no.timeout);
        return {
          tipo: 'esperar',
          espera: { tipo: 'mensagem', chave, ...(limite !== null ? { ate: new Date(Date.parse(c.agora) + limite * 60_000).toISOString() } : {}) },
        };
      }
      case 'humana': {
        const resp = (no.responsavel ?? { tipo: 'dona' }) as { tipo: string; valor?: unknown };
        const pessoa = resp.tipo === 'expressao' ? calcular(String(resp.valor)) : resp.valor;
        const prazo = duracaoMin(no.prazo);
        const lembrete = Number(no.lembrete_h ?? 0);
        return {
          tipo: 'esperar',
          espera: {
            tipo: 'humana',
            titulo: String(no.titulo ?? ''),
            descricao: String(no.descricao ?? ''),
            responsavel: resp.tipo,
            pessoa: pessoa ?? null,
            grupo: resp.tipo === 'grupo' ? resp.valor : null,
            lista: no.lista ?? null,
            formulario: Array.isArray(no.formulario) ? no.formulario : [],
            escolhas: Array.isArray(no.escolhas) ? no.escolhas : [],
            ...(prazo !== null ? { ate: new Date(Date.parse(c.agora) + prazo * 60_000).toISOString() } : {}),
            ...(lembrete > 0 && prazo !== null ? { lembrete: new Date(Date.parse(c.agora) + Math.max(prazo - lembrete * 60, 0) * 60_000).toISOString() } : {}),
            escalar: no.escalar ?? null,
            xp: no.xp === true || g.opcoes?.xp_humana === true,
          },
        };
      }
      case 'subprocesso':
        return { tipo: 'esperar', espera: { tipo: 'subprocesso', funcao: String(no.funcao), entradas: entradas() } };
      case 'multi': {
        const lista = calcular(String(no.lista));
        const itens = Array.isArray(lista) ? lista.slice(0, Number(no.max ?? LIMITES.multi)) : [];
        return { tipo: 'esperar', espera: { tipo: 'multi', funcao: String(no.funcao), itens, entradas: entradas(), sequencial: no.sequencial === true } };
      }
    }
  } catch (e) {
    return { tipo: 'falha', erro: e instanceof Error ? e.message : String(e) };
  }
  return { tipo: 'falha', erro: `Nó de tipo desconhecido: ${String(no.tipo)}` };
}

/** Depois de uma espera: por onde seguir (a escolha da tarefa humana, o caminho do prazo). */
export function aposEspera(g: Grafo, noId: string, escopo: Escopo, como: { escolha?: string; prazo?: boolean; erro?: boolean }): Proximo[] {
  const saem = g.arestas.filter((a) => a.de === noId);
  let caminho: Aresta[];
  if (como.prazo) caminho = saem.filter((a) => a.prazo);
  else if (como.erro) caminho = saem.filter((a) => a.erro);
  else if (como.escolha && saem.some((a) => a.escolha === como.escolha)) caminho = saem.filter((a) => a.escolha === como.escolha);
  else caminho = saem.filter((a) => !a.erro && !a.prazo && !a.escolha);
  if (caminho.length === 0) caminho = saem.filter((a) => !a.erro && !a.prazo);
  return caminho.map((a) => ({ no: a.para, escopo }));
}

/** As saídas do nó (mapeamento `nome → expressão` sobre `retorno.*` e `var.*`) depois da espera. */
export function saidasDoNo(g: Grafo, noId: string, c: Contexto, expr: ExprApi): Record<string, unknown> {
  const no = g.nos.find((n) => n.id === noId);
  const out: Record<string, unknown> = {};
  // Formulário da tarefa humana: cada campo vira variável com o mesmo nome
  if (no?.tipo === 'humana' && c.retorno?.formulario && typeof c.retorno.formulario === 'object') {
    Object.assign(out, c.retorno.formulario as Record<string, unknown>);
  }
  for (const [k, v] of Object.entries((no?.saidas as Record<string, string>) ?? {})) {
    const r = expr.avaliar(v, espacos(c), { today: c.hoje, now: c.agora });
    if (r.ok) out[k] = r.value;
  }
  return out;
}
