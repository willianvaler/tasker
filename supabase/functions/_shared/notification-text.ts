// Texto e destino de cada notificação. Compartilhado entre o app (tela 🔔) e a Edge Function de
// push (supabase/functions/push), para o aviso no celular dizer o mesmo que a tela. Sem imports:
// roda no Node/Metro e no Deno.

export type NotificationLike = { kind: string; payload: unknown };

export type NotificationLocale = 'pt-BR' | 'en' | 'es';

type P = Record<string, string | number | undefined>;
const n = (v: unknown) => Number(v);

// Frases por idioma (F3). O idioma é o do aparelho que recebe o push (push_tokens.locale) ou o do
// app, na tela 🔔. Variáveis vêm do payload, gravado pelo banco sem tradução.
const TEXT: Record<
  NotificationLocale,
  Record<string, (p: P, by: string, folder: string) => string>
> = {
  'pt-BR': {
    someone: () => 'Alguém',
    in: (p) => ` em ${p.folder_name}`,
    assigned: (p, by, f) => `${by} te atribuiu "${p.title}"${f}`,
    assignedMany: (p, _, f) =>
      `${p.count} ${n(p.count) === 1 ? 'tarefa passou' : 'tarefas passaram'} a ser suas${f}`,
    mention: (p, by) => `${by} te mencionou em "${p.title}": ${p.body}`,
    member_joined: (_, by, f) => `${by} entrou${f}`,
    team_invited: (p, by) => `${by} te convidou para o time ${p.team_name}`,
    team_joined: (p, by) => `${p.name ?? by} entrou no time ${p.team_name}`,
    join_requested: (p, by) => `${by} pediu para entrar no time ${p.team_name}`,
    join_approved: (p) => `Você entrou no time ${p.team_name}`,
    task_ready: (p) => `"${p.prereq}" foi concluída: já pode "${p.title}"`,
    task_ready_lag: (p) => `"${p.prereq}" foi concluída: em ${p.lag} min já pode "${p.title}"`,
    prereq_reopened: (p) => `"${p.prereq}" foi reaberta: "${p.title}" voltou a esperar`,
    automation: (p) => `Automação: "${p.title}"`,
    page_reminder: (p, by) => `${by} lembrou você de "${p.page_name}"`,
    page_reminder_days: (p, by) =>
      `${by} lembrou você de "${p.page_name}" (${p.days} ${n(p.days) === 1 ? 'dia' : 'dias'} sem registro)`,
    workout_invite: (p, by) => `${by} começou o treino "${p.page_name}" com você: entrar`,
    challenge_started: (p, by) =>
      `${by} começou o desafio "${p.name}" (${p.days} ${n(p.days) === 1 ? 'dia' : 'dias'})`,
    other: () => 'Novidade',
  },
  en: {
    someone: () => 'Someone',
    in: (p) => ` in ${p.folder_name}`,
    assigned: (p, by, f) => `${by} assigned you "${p.title}"${f}`,
    assignedMany: (p, _, f) =>
      `${p.count} ${n(p.count) === 1 ? 'task is' : 'tasks are'} now yours${f}`,
    mention: (p, by) => `${by} mentioned you in "${p.title}": ${p.body}`,
    member_joined: (_, by, f) => `${by} joined${f}`,
    team_invited: (p, by) => `${by} invited you to the team ${p.team_name}`,
    team_joined: (p, by) => `${p.name ?? by} joined the team ${p.team_name}`,
    join_requested: (p, by) => `${by} asked to join the team ${p.team_name}`,
    join_approved: (p) => `You joined the team ${p.team_name}`,
    task_ready: (p) => `"${p.prereq}" is done: you can start "${p.title}"`,
    task_ready_lag: (p) => `"${p.prereq}" is done: you can start "${p.title}" in ${p.lag} min`,
    prereq_reopened: (p) => `"${p.prereq}" was reopened: "${p.title}" is waiting again`,
    automation: (p) => `Automation: "${p.title}"`,
    page_reminder: (p, by) => `${by} reminded you about "${p.page_name}"`,
    page_reminder_days: (p, by) =>
      `${by} reminded you about "${p.page_name}" (${p.days} ${n(p.days) === 1 ? 'day' : 'days'} without a log)`,
    workout_invite: (p, by) => `${by} started the workout "${p.page_name}" with you: join`,
    challenge_started: (p, by) =>
      `${by} started the challenge "${p.name}" (${p.days} ${n(p.days) === 1 ? 'day' : 'days'})`,
    other: () => 'News',
  },
  es: {
    someone: () => 'Alguien',
    in: (p) => ` en ${p.folder_name}`,
    assigned: (p, by, f) => `${by} te asignó "${p.title}"${f}`,
    assignedMany: (p, _, f) =>
      `${p.count} ${n(p.count) === 1 ? 'tarea pasó' : 'tareas pasaron'} a ser tuyas${f}`,
    mention: (p, by) => `${by} te mencionó en "${p.title}": ${p.body}`,
    member_joined: (_, by, f) => `${by} se unió${f}`,
    team_invited: (p, by) => `${by} te invitó al equipo ${p.team_name}`,
    team_joined: (p, by) => `${p.name ?? by} se unió al equipo ${p.team_name}`,
    join_requested: (p, by) => `${by} pidió unirse al equipo ${p.team_name}`,
    join_approved: (p) => `Te uniste al equipo ${p.team_name}`,
    task_ready: (p) => `"${p.prereq}" se completó: ya puedes hacer "${p.title}"`,
    task_ready_lag: (p) =>
      `"${p.prereq}" se completó: en ${p.lag} min ya puedes hacer "${p.title}"`,
    prereq_reopened: (p) => `"${p.prereq}" se reabrió: "${p.title}" vuelve a esperar`,
    automation: (p) => `Automatización: "${p.title}"`,
    page_reminder: (p, by) => `${by} te recordó "${p.page_name}"`,
    page_reminder_days: (p, by) =>
      `${by} te recordó "${p.page_name}" (${p.days} ${n(p.days) === 1 ? 'día' : 'días'} sin registro)`,
    workout_invite: (p, by) => `${by} empezó el entrenamiento "${p.page_name}" contigo: entrar`,
    challenge_started: (p, by) =>
      `${by} empezó el desafío "${p.name}" (${p.days} ${n(p.days) === 1 ? 'día' : 'días'})`,
    other: () => 'Novedad',
  },
};

/** Idioma conhecido (ou o português, o padrão do app). */
export function notificationLocale(value: unknown): NotificationLocale {
  return value === 'en' || value === 'es' ? value : 'pt-BR';
}

/** Texto e destino de cada aviso, no idioma pedido (padrão: português). */
export function describeNotification(
  notification: NotificationLike,
  locale: string = 'pt-BR',
): {
  text: string;
  taskId?: string;
  folderId?: string;
  teamId?: string;
  /** Convite para um time de que ainda não faço parte: abre a página do convite */
  teamInvite?: string;
  /** Página (lembrete de página recebida) */
  pageId?: string;
  /** Outro destino no app (ex.: entrar no treino junto, abrir o desafio) */
  url?: string;
} {
  const tx = TEXT[notificationLocale(locale)];
  const p = (notification.payload ?? {}) as P;
  const by = p.by ? String(p.by) : tx.someone(p, '', '');
  const folder = p.folder_name ? tx.in(p, by, '') : '';
  const say = (key: string) => tx[key](p, by, folder);
  switch (notification.kind) {
    case 'assigned':
      return p.task_id
        ? { text: say('assigned'), taskId: String(p.task_id) }
        : {
            text: say('assignedMany'),
            folderId: p.folder_id ? String(p.folder_id) : undefined,
          };
    case 'mention':
      return { text: say('mention'), taskId: String(p.task_id) };
    case 'member_joined':
      return {
        text: say('member_joined'),
        folderId: p.folder_id ? String(p.folder_id) : undefined,
      };
    case 'team_invited':
      return { text: say('team_invited'), teamInvite: String(p.token) };
    case 'team_joined':
      return { text: say('team_joined'), teamId: String(p.team_id) };
    case 'join_requested':
      return { text: say('join_requested'), teamId: String(p.team_id) };
    case 'join_approved':
      return { text: say('join_approved'), teamId: String(p.team_id) };
    case 'task_ready':
      return {
        text: n(p.lag) ? say('task_ready_lag') : say('task_ready'),
        taskId: String(p.task_id),
      };
    case 'prereq_reopened':
      return { text: say('prereq_reopened'), taskId: String(p.task_id) };
    case 'automation':
      return {
        // A mensagem da automação foi escrita por quem a criou: vai como está
        text: p.message ? `${p.message}: "${p.title}"` : say('automation'),
        taskId: String(p.task_id),
      };
    case 'page_reminder':
      return {
        text: n(p.days) ? say('page_reminder_days') : say('page_reminder'),
        pageId: String(p.page_id),
      };
    case 'workout_invite':
      return {
        text: say('workout_invite'),
        url: `/treino/${p.page_id}?sessao=${p.session_id}`,
      };
    case 'challenge_started':
      return { text: say('challenge_started'), url: `/desafio/${p.challenge_id}` };
    case 'task_reminder': {
      // Lembrete de tarefa com horário (D206): "⏰ 20/10 15:00 · Ligar para o banco" (10/20 em inglês)
      const [, m, d] = String(p.due_date ?? '').split('-');
      const date =
        m && d ? (notificationLocale(locale) === 'en' ? `${m}/${d} ` : `${d}/${m} `) : '';
      return {
        text: `⏰ ${date}${p.due_time ?? ''} · ${p.title}`,
        taskId: String(p.task_id),
      };
    }
    default:
      return { text: say('other') };
  }
}

/**
 * Mensagens do push (formato da API da Expo) para os aparelhos do usuário. Cada aparelho recebe no
 * idioma dele (token como texto: idioma do perfil ou português).
 */
export function pushMessages(
  notification: NotificationLike,
  tokens: (string | { token: string; locale?: string | null })[],
  fallbackLocale?: string | null,
) {
  return tokens.map((entry) => {
    const { token, locale } = typeof entry === 'string' ? { token: entry, locale: null } : entry;
    return pushMessage(notification, token, locale ?? fallbackLocale ?? 'pt-BR');
  });
}

function pushMessage(notification: NotificationLike, to: string, locale: string) {
  const {
    text,
    taskId,
    folderId,
    teamId,
    teamInvite,
    pageId,
    url: direct,
  } = describeNotification(notification, locale);
  const url = direct
    ? direct
    : taskId
      ? `/task/${taskId}`
      : pageId
        ? `/page/${pageId}`
        : folderId
          ? `/folder/${folderId}`
          : teamId
            ? `/team/${teamId}`
            : teamInvite
              ? `/team-invite/${teamInvite}`
              : '/notifications';
  return { to, title: 'Questlist', body: text, sound: 'default', data: { url } };
}
