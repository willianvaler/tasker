import { addDays, makeDate, nextDayMonth, nextWeekday, type IsoDate } from './dates';

// Sintaxe rápida do título (ESCOPO 4.1). Nada é obrigatório: o que não for reconhecido fica no título.
//   !, !!, !!!            prioridade baixa / média / alta
//   #etiqueta              etiqueta
//   @nome                  responsável (só quando `mentions` está ligado, em páginas de projeto)
//   hoje, amanhã, depois de amanhã, sexta, sexta-feira, 15/10, 15/10/2026   vencimento
//   /diaria /semanal /mensal /seg,qua,sex   recorrência
//   4x12, 20kg             séries x repetições e carga (só com `meta`, nas páginas de cards)
// Um "na", "no", "até", "para"... logo antes da data sai junto ("comprar presente para sexta").

export type Recurrence =
  | { type: 'daily' }
  | { type: 'weekly' }
  | { type: 'monthly' }
  /** days: 0 = domingo ... 6 = sábado */
  | { type: 'weekdays'; days: number[] };

export type Priority = 0 | 1 | 2 | 3;

/** Detalhe de exercício dos cards (ESCOPO 4.3); genérico o bastante para "3x" de qualquer coisa. */
export type TaskMeta = { sets?: number; reps?: number; weight?: string };

export type ParsedTask = {
  title: string;
  /** Só com a opção `meta` (páginas de cards): "4x12" e "20kg" saem do título. */
  meta: TaskMeta | null;
  priority: Priority;
  dueDate: IsoDate | null;
  labels: string[];
  mentions: string[];
  recurrence: Recurrence | null;
};

export type QuickParseOptions = {
  /** Hoje no fuso do usuário ('YYYY-MM-DD'), base das datas relativas. */
  today: IsoDate;
  /** Reconhecer @nome (páginas de projeto). Desligado, o @nome fica no título. */
  mentions?: boolean;
  /** Reconhecer "4x12" (séries x repetições) e "20kg" / "12,5 kg" (carga). Usado nas páginas de cards. */
  meta?: boolean;
};

/** Tira acentos e passa para minúsculas, para comparar palavras. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Só nomes completos: abreviações como "ter" e "qua" são palavras comuns ("ter reunião")
const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};
const RECURRENCE_DAYS: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};
const DATE_PREPOSITIONS = new Set(['na', 'no', 'ate', 'em', 'dia', 'para', 'pra', 'pro']);

const PRIORITY_RE = /^!{1,3}$/;
const LABEL_RE = /^#([\p{L}\p{N}_-]+)$/u;
const MENTION_RE = /^@([\p{L}\p{N}._-]+)$/u;
const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;
const SETS_RE = /^(\d{1,3})x(\d{1,4})$/i;
const WEIGHT_RE = /^(\d{1,4}(?:[.,]\d{1,2})?)(kg|lb|lbs)$/i;

function parseRecurrence(token: string): Recurrence | null {
  if (!token.startsWith('/')) return null;
  const word = fold(token.slice(1));
  if (word === 'diaria') return { type: 'daily' };
  if (word === 'semanal') return { type: 'weekly' };
  if (word === 'mensal') return { type: 'monthly' };
  const parts = word.split(',');
  if (parts.length === 0 || !parts.every((p) => p in RECURRENCE_DAYS)) return null;
  const days = [...new Set(parts.map((p) => RECURRENCE_DAYS[p]))].sort((a, b) => a - b);
  return { type: 'weekdays', days };
}

/** Tenta ler uma data começando em tokens[i]; devolve a data e quantos tokens ela ocupa. */
function parseDateAt(
  tokens: string[],
  i: number,
  today: IsoDate,
): { date: IsoDate; length: number } | null {
  const word = fold(tokens[i]);
  if (word === 'hoje') return { date: today, length: 1 };
  if (word === 'amanha') return { date: addDays(today, 1), length: 1 };
  if (
    word === 'depois' &&
    fold(tokens[i + 1] ?? '') === 'de' &&
    fold(tokens[i + 2] ?? '') === 'amanha'
  ) {
    return { date: addDays(today, 2), length: 3 };
  }

  const weekday = WEEKDAYS[word.replace(/-feira$/, '')];
  if (weekday !== undefined) return { date: nextWeekday(today, weekday), length: 1 };

  const m = DATE_RE.exec(tokens[i]);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let date: IsoDate | null;
    if (m[3]) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      date = makeDate(year, month, day);
    } else {
      date = nextDayMonth(today, day, month);
    }
    if (date) return { date, length: 1 };
  }
  return null;
}

export function parseQuickInput(text: string, options: QuickParseOptions): ParsedTask {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  const result: ParsedTask = {
    title: '',
    meta: null,
    priority: 0,
    dueDate: null,
    labels: [],
    mentions: [],
    recurrence: null,
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (PRIORITY_RE.test(token)) {
      result.priority = token.length as Priority;
      continue;
    }
    const label = LABEL_RE.exec(token);
    if (label) {
      const name = label[1].toLowerCase();
      if (!result.labels.includes(name)) result.labels.push(name);
      continue;
    }
    const mention = options.mentions ? MENTION_RE.exec(token) : null;
    if (mention) {
      if (!result.mentions.includes(mention[1])) result.mentions.push(mention[1]);
      continue;
    }
    if (options.meta) {
      const sets = SETS_RE.exec(token);
      if (sets) {
        result.meta = { ...result.meta, sets: Number(sets[1]), reps: Number(sets[2]) };
        continue;
      }
      // "20kg" ou "20 kg"
      const unit =
        /^(kg|lb|lbs)$/i.test(tokens[i + 1] ?? '') && /^\d{1,4}(?:[.,]\d{1,2})?$/.test(token);
      const weight = WEIGHT_RE.exec(unit ? token + tokens[i + 1] : token);
      if (weight) {
        result.meta = { ...result.meta, weight: `${weight[1]}${weight[2].toLowerCase()}` };
        if (unit) i++;
        continue;
      }
    }
    const recurrence = result.recurrence ? null : parseRecurrence(token);
    if (recurrence) {
      result.recurrence = recurrence;
      continue;
    }
    // Só a primeira data conta; as seguintes ficam no título
    const date = result.dueDate ? null : parseDateAt(tokens, i, options.today);
    if (date) {
      result.dueDate = date.date;
      if (kept.length > 0 && DATE_PREPOSITIONS.has(fold(kept[kept.length - 1]))) kept.pop();
      i += date.length - 1;
      continue;
    }
    kept.push(token);
  }

  result.title = kept.join(' ');
  // Sobrou só sintaxe ("amanhã", "#casa"): melhor manter o texto como título do que criar tarefa sem nome
  if (!result.title) {
    return {
      ...result,
      title: tokens.join(' '),
      meta: null,
      priority: 0,
      dueDate: null,
      labels: [],
      mentions: [],
      recurrence: null,
    };
  }
  return result;
}
