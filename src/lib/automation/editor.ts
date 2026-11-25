// Editor de automações em formulário (ESCOPO_V14 §9, AU7, D341): funções puras entre a definição
// guardada no banco e o que o formulário mostra. Textos por tr() (módulo puro).
import { tr } from '@/lib/i18n-ref';

import type { Condicao, Escopo, Passo } from './registry';

export type Definicao = {
  v: 1;
  gatilho: { tipo: string; [chave: string]: unknown };
  condicoes?: Condicao | null;
  passos: Passo[];
  limites?: { cooldown_min?: number; atraso_max_min?: number };
};

/** Uma condição do formulário: uma pronta ou uma comparação, com "não" opcional. */
export type ItemCondicao =
  | { pronta: string; nao?: boolean; [chave: string]: unknown }
  | { campo: string; op: string; valor?: unknown; nao?: boolean };

export type CondicoesForm = { modo: 'e' | 'ou'; itens: ItemCondicao[] };

const folha = (
  c: Condicao,
): c is Extract<Condicao, { pronta: string }> | Extract<Condicao, { campo: string }> =>
  'pronta' in c || 'campo' in c;

/**
 * A árvore que o formulário sabe editar: E ou OU de condições simples (cada uma podendo ser NÃO).
 * Outra forma (aninhada, criada fora do formulário) volta como 'avancada' e fica só para ler.
 */
export function lerCondicoes(c: Condicao | null | undefined): CondicoesForm | 'avancada' {
  if (!c) return { modo: 'e', itens: [] };
  const item = (x: Condicao): ItemCondicao | null => {
    if ('nao' in x && x.nao && typeof x.nao === 'object' && folha(x.nao as Condicao)) {
      return { ...(x.nao as ItemCondicao), nao: true };
    }
    return folha(x) ? ({ ...x } as ItemCondicao) : null;
  };
  const lista = 'e' in c ? c.e : 'ou' in c ? c.ou : [c];
  const itens = (Array.isArray(lista) ? lista : []).map(item);
  if (itens.some((x) => x === null)) return 'avancada';
  return { modo: 'ou' in c ? 'ou' : 'e', itens: itens as ItemCondicao[] };
}

export function montarCondicoes(f: CondicoesForm): Condicao | null {
  if (f.itens.length === 0) return null;
  const itens = f.itens.map(({ nao, ...resto }) =>
    nao ? { nao: resto as Condicao } : (resto as Condicao),
  );
  return f.modo === 'ou' ? { ou: itens } : { e: itens };
}

/** Definição de partida para uma regra nova. */
export function definicaoVazia(escopo: Escopo): Definicao {
  return {
    v: 1,
    gatilho: { tipo: escopo === 'projeto' ? 'tarefa.concluida' : 'manual' },
    condicoes: null,
    passos: [{ tipo: 'notificar', titulo: '', corpo: '', canal: 'ambos' }],
  };
}

/** Passo novo de um tipo, com os campos vazios. */
export function passoNovo(tipo: string): Passo {
  switch (tipo) {
    case 'notificar':
      return { tipo, titulo: '', corpo: '', canal: 'ambos' };
    case 'criar_tarefa':
      return { tipo, titulo: '' };
    case 'atualizar_tarefa':
      return { tipo, adicionar_etiquetas: [] };
    case 'esperar':
      return { tipo, minutos: 10 };
    case 'descanso':
      return { tipo, segundos: 60 };
    case 'definir_variavel':
      return { tipo, nome: '', valor: '' };
    case 'se':
      return {
        tipo,
        condicao: { pronta: 'dias_semana', dias: [1, 2, 3, 4, 5] },
        entao: [],
        senao: [],
      };
    case 'enviar_webhook':
      return { tipo, url: 'https://', metodo: 'POST', corpo: { texto: '{{evento.titulo}}' } };
    case 'alternar_modo_jogo':
      return { tipo, modo: 'light' };
    case 'pagina.anexar_texto':
      return { tipo, texto: '' };
    case 'pagina.definir_propriedade':
      return { tipo, propriedade: 'status', valor: '' };
    case 'pagina.adicionar_tag':
      return { tipo, tag: '' };
    default:
      return { tipo };
  }
}

// ---------------------------------------------------------------------------------------------
// Modelos (V14 §9): curados pelo app
// ---------------------------------------------------------------------------------------------

export type Modelo = {
  id: string;
  titulo: () => string;
  descricao: () => string;
  /** Precisa de algo que ainda não existe (o conector de dispositivos chega no SL3). */
  precisa?: 'dispositivos';
  montar: (ctx: { inbox?: string }) => { name: string; definition: Definicao };
};

export const MODELOS: Modelo[] = [
  {
    id: 'tomada',
    titulo: () => tr('auto.ed.model.plug'),
    descricao: () => tr('auto.ed.model.plugHint'),
    precisa: 'dispositivos',
    montar: () => ({
      name: tr('auto.ed.model.plug'),
      definition: {
        v: 1,
        gatilho: { tipo: 'tarefa.concluida' },
        passos: [{ tipo: 'comandar_dispositivo' }],
      },
    }),
  },
  {
    id: 'ar',
    titulo: () => tr('auto.ed.model.ac'),
    descricao: () => tr('auto.ed.model.acHint'),
    precisa: 'dispositivos',
    montar: () => ({
      name: tr('auto.ed.model.ac'),
      definition: {
        v: 1,
        gatilho: { tipo: 'horario', hora: '22:30' },
        passos: [{ tipo: 'comandar_dispositivo' }],
      },
    }),
  },
  {
    id: 'atrasadas',
    titulo: () => tr('auto.ed.model.overdue'),
    descricao: () => tr('auto.ed.model.overdueHint'),
    montar: () => ({
      name: tr('auto.ed.model.overdue'),
      definition: {
        v: 1,
        gatilho: { tipo: 'horario', hora: '19:00' },
        condicoes: { e: [{ campo: 'usuario.atrasadas', op: '>', valor: 0 }] },
        passos: [
          {
            tipo: 'notificar',
            titulo: tr('auto.ed.model.overdueTitle'),
            corpo: tr('auto.ed.model.overdueBody', { n: '{{usuario.atrasadas}}' }),
            canal: 'ambos',
          },
        ],
      },
    }),
  },
  {
    id: 'discord',
    titulo: () => tr('auto.ed.model.discord'),
    descricao: () => tr('auto.ed.model.discordHint'),
    montar: () => ({
      name: tr('auto.ed.model.discord'),
      definition: {
        v: 1,
        gatilho: { tipo: 'nivel.subiu' },
        passos: [
          {
            tipo: 'enviar_webhook',
            url: 'https://discord.com/api/webhooks/',
            metodo: 'POST',
            corpo: { content: tr('auto.ed.model.discordBody', { level: '{{evento.nivel}}' }) },
          },
        ],
      },
    }),
  },
  {
    id: 'discord-boss',
    titulo: () => tr('auto.ed.model.discordBoss'),
    descricao: () => tr('auto.ed.model.discordBossHint'),
    montar: () => ({
      name: tr('auto.ed.model.discordBoss'),
      definition: {
        v: 1,
        gatilho: { tipo: 'boss.derrotado' },
        passos: [
          {
            tipo: 'enviar_webhook',
            url: 'https://discord.com/api/webhooks/',
            metodo: 'POST',
            corpo: { content: tr('auto.ed.model.discordBossBody', { boss: '{{evento.boss_nome}}' }) },
          },
        ],
      },
    }),
  },
  {
    id: 'entrada',
    titulo: () => tr('auto.ed.model.hook'),
    descricao: () => tr('auto.ed.model.hookHint'),
    montar: ({ inbox }) => ({
      name: tr('auto.ed.model.hook'),
      definition: {
        v: 1,
        gatilho: { tipo: 'webhook' },
        passos: [
          {
            tipo: 'criar_tarefa',
            titulo: `{{hook.titulo|padrao:"${tr('auto.ed.model.hookTask')}"}}`,
            ...(inbox ? { lista: inbox } : {}),
          },
        ],
      },
    }),
  },
];

// ---------------------------------------------------------------------------------------------
// Testar: um evento de exemplo de cada gatilho
// ---------------------------------------------------------------------------------------------

export function eventoExemplo(
  tipo: string,
  ctx: { hoje: string; agora: string; nivel?: number; lista?: { id: string; nome: string } },
): Record<string, unknown> {
  const tarefa = {
    tarefa: '00000000-0000-4000-8000-000000000001',
    titulo: tr('auto.ed.sample.task'),
    lista: ctx.lista?.id ?? '00000000-0000-4000-8000-000000000002',
    lista_nome: ctx.lista?.nome ?? tr('auto.ed.sample.list'),
    projeto_nome: tr('auto.ed.sample.project'),
    etiquetas: [tr('auto.ed.sample.label')],
    vencimento: ctx.hoje,
  };
  switch (tipo) {
    case 'tarefa.criada':
    case 'tarefa.pronta':
    case 'tarefa.atribuida':
      return tarefa;
    case 'tarefa.concluida':
      return { ...tarefa, concluida_em: ctx.agora };
    case 'tarefa.atrasada':
      return { ...tarefa, atraso_min: 5 };
    case 'tarefa.vencendo':
      return { ...tarefa, faltam_min: 60 };
    case 'lista.concluida':
      return {
        lista: tarefa.lista,
        lista_nome: tarefa.lista_nome,
        projeto_nome: tarefa.projeto_nome,
      };
    case 'nivel.subiu':
      return { nivel: (ctx.nivel ?? 1) + 1, nivel_anterior: ctx.nivel ?? 1 };
    case 'boss.derrotado':
      return { boss_nome: tr('auto.ed.sample.boss'), nivel: ctx.nivel ?? 1 };
    case 'marco.atingido':
      return { marco_nome: tr('auto.ed.sample.milestone'), projeto_nome: tarefa.projeto_nome };
    case 'horario':
    case 'intervalo':
      return { agora: ctx.agora, previsto: ctx.agora };
    case 'webhook':
      return {
        hook: { titulo: tr('auto.ed.sample.hookTitle'), nome: tr('auto.ed.sample.hookName') },
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------------------------
// Frase da lista
// ---------------------------------------------------------------------------------------------

const DIAS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** "Todo dia às 22:30", "Seg, Qua às 07:00", "A cada 2 h", "Tarefa concluída". */
export function resumoGatilho(g: Definicao['gatilho']): string {
  switch (g.tipo) {
    case 'horario': {
      const dias = Array.isArray(g.dias) ? g.dias.map(Number) : [];
      const quando =
        dias.length === 0 || dias.length === 7
          ? tr('auto.ed.everyDay')
          : dias.map((d) => tr(`auto.ed.dayShort.${DIAS[d] ?? 'sun'}`)).join(', ');
      return tr('auto.ed.atTime', { when: quando, time: String(g.hora ?? '') });
    }
    case 'intervalo':
      return tr('auto.ed.everyHours', { hours: Number(g.horas ?? 1) });
    case 'tarefa.vencendo':
      return tr('auto.ed.dueIn', { minutes: Number(g.minutos ?? 60) });
    default:
      return tr(`auto.motor.gatilho.${g.tipo.replace(/\./g, '_')}`);
  }
}

/** Erro que dá para mostrar antes de mandar ao banco (o banco valida de novo). */
export function conferirRascunho(name: string, def: Definicao): string | null {
  if (!name.trim()) return tr('auto.ed.err.name');
  if (def.passos.length === 0) return tr('auto.ed.err.noSteps');
  if (
    def.gatilho.tipo === 'horario' &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(def.gatilho.hora ?? ''))
  ) {
    return tr('auto.ed.err.time');
  }
  const todos = (lista: Passo[]): Passo[] =>
    lista.flatMap((p) => [
      p,
      ...todos(Array.isArray(p.entao) ? (p.entao as Passo[]) : []),
      ...todos(Array.isArray(p.senao) ? (p.senao as Passo[]) : []),
    ]);
  for (const p of todos(def.passos)) {
    if (p.tipo === 'comandar_dispositivo') return tr('auto.ed.err.devices');
    if (p.tipo === 'notificar' && !String(p.titulo ?? '').trim() && !String(p.corpo ?? '').trim())
      return tr('auto.ed.err.notify');
    if (p.tipo === 'criar_tarefa' && !String(p.titulo ?? '').trim())
      return tr('auto.ed.err.taskTitle');
    if (p.tipo === 'enviar_webhook' && !/^https:\/\/.+\..+/.test(String(p.url ?? '')))
      return tr('auto.ed.err.url');
  }
  return null;
}
