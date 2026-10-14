// Texto e destino de cada notificação. Compartilhado entre o app (tela 🔔) e a Edge Function de
// push (supabase/functions/push), para o aviso no celular dizer o mesmo que a tela. Sem imports:
// roda no Node/Metro e no Deno.

export type NotificationLike = { kind: string; payload: unknown };

/** Texto e destino de cada aviso. */
export function describeNotification(n: NotificationLike): {
  text: string;
  taskId?: string;
  folderId?: string;
  teamId?: string;
} {
  const p = (n.payload ?? {}) as Record<string, string | number | undefined>;
  const by = p.by ? String(p.by) : 'Alguém';
  const folder = p.folder_name ? ` em ${p.folder_name}` : '';
  switch (n.kind) {
    case 'assigned':
      return p.task_id
        ? { text: `${by} te atribuiu "${p.title}"${folder}`, taskId: String(p.task_id) }
        : {
            text: `${p.count} ${p.count === 1 ? 'tarefa passou' : 'tarefas passaram'} a ser suas${folder}`,
            folderId: p.folder_id ? String(p.folder_id) : undefined,
          };
    case 'mention':
      return { text: `${by} te mencionou em "${p.title}": ${p.body}`, taskId: String(p.task_id) };
    case 'member_joined':
      return {
        text: `${by} entrou${folder}`,
        folderId: p.folder_id ? String(p.folder_id) : undefined,
      };
    case 'team_invited':
      return { text: `${by} te convidou para o time ${p.team_name}`, teamId: String(p.team_id) };
    case 'team_joined':
      return { text: `${p.name ?? by} entrou no time ${p.team_name}`, teamId: String(p.team_id) };
    case 'join_requested':
      return { text: `${by} pediu para entrar no time ${p.team_name}`, teamId: String(p.team_id) };
    case 'join_approved':
      return { text: `Você entrou no time ${p.team_name}`, teamId: String(p.team_id) };
    default:
      return { text: 'Novidade' };
  }
}

/** Mensagem do push (formato da API da Expo) para os tokens do usuário. */
export function pushMessages(n: NotificationLike, tokens: string[]) {
  const { text, taskId, folderId, teamId } = describeNotification(n);
  const url = taskId
    ? `/task/${taskId}`
    : folderId
      ? `/folder/${folderId}`
      : teamId
        ? `/team/${teamId}`
        : '/notifications';
  return tokens.map((to) => ({
    to,
    title: 'Questlist',
    body: text,
    sound: 'default',
    data: { url },
  }));
}
