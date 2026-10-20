import { DEFAULT_REST_SECONDS, type RepeatPlan } from '../repeat';
import { addDays, dateLocale, makeDate, nextDayMonth, nextWeekday, type IsoDate } from './dates';

// Sintaxe rápida do título. Nada é obrigatório: o que não for reconhecido fica no título.
//   !, !!, !!!            prioridade baixa / média / alta
//   #etiqueta              etiqueta
//   @nome                  responsável (só quando `mentions` está ligado, em páginas de projeto)
//   ^trecho, ^2            pré-requisito: tarefa pelo título, ou o item 2 do lote (só com `prereqs`)
//   hoje, amanhã, depois de amanhã, sexta, sexta-feira, 15/10, 15/10/2026   vencimento
//     (também em inglês e espanhol: today, tomorrow, friday, hoy, mañana, viernes; a ordem de
//     15/10 segue o idioma do app: 10/15 em inglês)
//   /diaria /semanal /mensal /seg,qua,sex   recorrência (/daily /weekly /monthly /mon,wed;
//     /diario /mensual /lun,mie)
//   3x12, x5               repetições: 3 séries de 12 (com descanso) ou 5 vezes (contador), D123
//   20kg                   carga (só com `meta`, nas páginas de cards)
// Um "na", "no", "até", "para"... logo antes da data sai junto ("comprar presente para sexta").

export type Recurrence =
  | { type: 'daily' }
  | { type: 'weekly' }
  | { type: 'monthly' }
  /** days: 0 = domingo ... 6 = sábado */
  | { type: 'weekdays'; days: number[] };

export type Priority = 0 | 1 | 2 | 3;

/** Detalhe de exercício dos cards; genérico o bastante para "3x" de qualquer coisa. */
/** Grupo de séries avançadas: "2 séries de 10 com 40kg" (19/10). */
export type SetGroup = { sets: number; reps?: number; weight?: string };
export type TaskMeta = {
  sets?: number;
  reps?: number;
  weight?: string;
  /** Séries avançadas ("1×14, 2×10, 1×8"): o que cada série pede; `sets` é a soma */
  groups?: SetGroup[];
};

export type ParsedTask = {
  title: string;
  /** "4x12" (séries e repetições) e, nas páginas de cards, "20kg". */
  meta: TaskMeta | null;
  /** "3x12" → 3 séries com descanso; "x5" → contador de 5 (D123) */
  repeatPlan: RepeatPlan | null;
  priority: Priority;
  dueDate: IsoDate | null;
  /** "15h", "15:30", "3pm": horário 'HH:MM' (D206). Sem data, vale para hoje. */
  dueTime: string | null;
  labels: string[];
  mentions: string[];
  /** "^carvão" / "^2": de quem esta tarefa depende (resolvido depois, lib/prereqs.ts) */
  prereqs: string[];
  recurrence: Recurrence | null;
  /** "+publica", "+amigos", "+privada" (V10 §2, D232); sem marcador, privada */
  visibility?: TaskVisibility;
};

export type TaskVisibility = 'private' | 'friends' | 'public';

// Marcadores de visibilidade nos três idiomas (comparados sem acento)
const VISIBILITY_WORDS: Record<string, TaskVisibility> = {
  publica: 'public',
  publico: 'public',
  public: 'public',
  amigos: 'friends',
  friends: 'friends',
  privada: 'private',
  privado: 'private',
  private: 'private',
};

export type QuickParseOptions = {
  /** Hoje no fuso do usuário ('YYYY-MM-DD'), base das datas relativas. */
  today: IsoDate;
  /** Reconhecer @nome (páginas de projeto). Desligado, o @nome fica no título. */
  mentions?: boolean;
  /** Reconhecer ^pré-requisito (páginas de projeto). Desligado, fica no título. */
  prereqs?: boolean;
  /** Reconhecer a carga ("20kg" / "12,5 kg"). Usado nas páginas de cards. */
  meta?: boolean;
  /** Ordem de "10/15": dia/mês ou mês/dia. Padrão: a do idioma do app (mês/dia em inglês). */
  dateOrder?: 'dmy' | 'mdy';
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
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
};
const RECURRENCE_DAYS: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  lun: 1,
  mar: 2,
  mie: 3,
  jue: 4,
  vie: 5,
};
/** "às 15h" / "at 3pm" / "a las 15:00": a preposição sai do título junto com o horário */
const TIME_PREPOSITIONS = new Set(['as', 'at', 'las']);

/** "15h", "15h30", "9:05", "3pm", "3:30pm" → 'HH:MM' (ou null). */
export function parseTime(token: string): string | null {
  const t = token.toLowerCase();
  let m = /^([01]?\d|2[0-3])(?:h(?:([0-5]\d))?|:([0-5]\d))$/.exec(t);
  if (m) {
    const min = m[2] ?? m[3] ?? '00';
    return `${m[1].padStart(2, '0')}:${min}`;
  }
  m = /^(1[0-2]|0?[1-9])(?::([0-5]\d))?(am|pm)$/.exec(t);
  if (m) {
    const h = (Number(m[1]) % 12) + (m[3] === 'pm' ? 12 : 0);
    return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  }
  return null;
}

const DATE_PREPOSITIONS = new Set([
  'na',
  'no',
  'ate',
  'em',
  'dia',
  'para',
  'pra',
  'pro',
  'on',
  'by',
  'due',
  'until',
  'el',
  'hasta',
]);

const PRIORITY_RE = /^!{1,3}$/;
const LABEL_RE = /^#([\p{L}\p{N}_-]+)$/u;
const MENTION_RE = /^@([\p{L}\p{N}._-]+)$/u;
const PREREQ_RE = /^\^([\p{L}\p{N}._-]+)$/u;
const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;
const SETS_RE = /^(\d{1,2})[x×](\d{1,4})$/i;
const TIMES_RE = /^[x×](\d{1,2})$/i;
const WEIGHT_RE = /^(\d{1,4}(?:[.,]\d{1,2})?)(kg|lb|lbs)$/i;

function parseRecurrence(token: string): Recurrence | null {
  if (!token.startsWith('/')) return null;
  const word = fold(token.slice(1));
  if (word === 'diaria' || word === 'diario' || word === 'daily') return { type: 'daily' };
  if (word === 'semanal' || word === 'weekly') return { type: 'weekly' };
  if (word === 'mensal' || word === 'mensual' || word === 'monthly') return { type: 'monthly' };
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
  order: 'dmy' | 'mdy',
): { date: IsoDate; length: number } | null {
  const word = fold(tokens[i]);
  const next = fold(tokens[i + 1] ?? '');
  const after = fold(tokens[i + 2] ?? '');
  if (word === 'hoje' || word === 'today' || word === 'hoy') return { date: today, length: 1 };
  if (
    (word === 'depois' && next === 'de' && after === 'amanha') ||
    (word === 'day' && next === 'after' && after === 'tomorrow')
  )
    return { date: addDays(today, 2), length: 3 };
  if (word === 'pasado' && next === 'manana') return { date: addDays(today, 2), length: 2 };
  if (word === 'amanha' || word === 'tomorrow' || word === 'manana')
    return { date: addDays(today, 1), length: 1 };

  const weekday = WEEKDAYS[word.replace(/-feira$/, '')];
  if (weekday !== undefined) return { date: nextWeekday(today, weekday), length: 1 };

  const m = DATE_RE.exec(tokens[i]);
  if (m) {
    const day = Number(order === 'mdy' ? m[2] : m[1]);
    const month = Number(order === 'mdy' ? m[1] : m[2]);
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
    repeatPlan: null,
    priority: 0,
    dueDate: null,
    dueTime: null,
    labels: [],
    mentions: [],
    prereqs: [],
    recurrence: null,
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (PRIORITY_RE.test(token)) {
      result.priority = token.length as Priority;
      continue;
    }
    const visibility = token.startsWith('+') ? VISIBILITY_WORDS[fold(token.slice(1))] : undefined;
    if (visibility) {
      result.visibility = visibility;
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
    const prereq = options.prereqs ? PREREQ_RE.exec(token) : null;
    if (prereq) {
      if (!result.prereqs.includes(prereq[1])) result.prereqs.push(prereq[1]);
      continue;
    }
    const sets = result.repeatPlan ? null : SETS_RE.exec(token);
    if (sets && Number(sets[1]) > 0) {
      result.meta = { ...result.meta, sets: Number(sets[1]), reps: Number(sets[2]) };
      result.repeatPlan = {
        mode: 'sets',
        total: Number(sets[1]),
        rest_seconds: DEFAULT_REST_SECONDS,
      };
      continue;
    }
    const times = result.repeatPlan ? null : TIMES_RE.exec(token);
    if (times && Number(times[1]) > 1) {
      result.repeatPlan = { mode: 'count', total: Number(times[1]) };
      continue;
    }
    if (options.meta) {
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
    const time = result.dueTime ? null : parseTime(token);
    if (time) {
      result.dueTime = time;
      if (kept.length > 0 && TIME_PREPOSITIONS.has(fold(kept[kept.length - 1]))) {
        // "a las": tira o "a" também
        if (
          fold(kept.pop() ?? '') === 'las' &&
          kept.length > 0 &&
          fold(kept[kept.length - 1]) === 'a'
        )
          kept.pop();
      }
      continue;
    }
    // Só a primeira data conta; as seguintes ficam no título
    const order = options.dateOrder ?? (dateLocale() === 'en' ? 'mdy' : 'dmy');
    const date = result.dueDate ? null : parseDateAt(tokens, i, options.today, order);
    if (date) {
      result.dueDate = date.date;
      if (kept.length > 0 && DATE_PREPOSITIONS.has(fold(kept[kept.length - 1]))) kept.pop();
      i += date.length - 1;
      continue;
    }
    kept.push(token);
  }

  // Horário sem data: hoje
  if (result.dueTime && !result.dueDate) result.dueDate = options.today;
  result.title = kept.join(' ');
  // Sobrou só sintaxe ("amanhã", "#casa"): melhor manter o texto como título do que criar tarefa sem nome
  if (!result.title) {
    return {
      ...result,
      title: tokens.join(' '),
      meta: null,
      repeatPlan: null,
      priority: 0,
      dueDate: null,
      dueTime: null,
      labels: [],
      mentions: [],
      prereqs: [],
      recurrence: null,
    };
  }
  return result;
}
