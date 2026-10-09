// Texto e destino de cada notificação. Compartilhado entre o app (tela 🔔) e a Edge Function de
// push (supabase/functions/push), para o aviso no celular dizer o mesmo que a tela. Sem imports:
// roda no Node/Metro e no Deno.

export type NotificationLike = { kind: string; payload: unknown };

/** Texto e destino de cada aviso. */
export function describeNotification(n: NotificationLike): {
  text: string;
  taskId?: string;
  folderId?: string;
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
    default:
      return { text: 'Novidade' };
  }
}

/** Mensagem do push (formato da API da Expo) para os tokens do usuário. */
export function pushMessages(n: NotificationLike, tokens: string[]) {
  const { text, taskId, folderId } = describeNotification(n);
  const url = taskId ? `/task/${taskId}` : folderId ? `/folder/${folderId}` : '/notifications';
  return tokens.map((to) => ({
    to,
    title: 'Questlist',
    body: text,
    sound: 'default',
    data: { url },
  }));
}
