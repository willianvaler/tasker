import type { Notification } from './queries/projects';

/** Texto e destino de cada aviso. */
export function describeNotification(n: Notification): {
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
