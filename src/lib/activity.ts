import type { Activity } from './queries/projects';

/** "Cris concluiu Comprar cerveja" (ESCOPO 4.5). */
export function describeActivity(a: Pick<Activity, 'action' | 'payload' | 'actor'>) {
  const p = (a.payload ?? {}) as Record<string, string | number | undefined>;
  const who = a.actor?.display_name || 'Alguém';
  switch (a.action) {
    case 'task_completed':
      return `${who} concluiu "${p.title}"`;
    case 'tasks_created':
      return p.count === 1 && p.title
        ? `${who} criou "${p.title}"`
        : `${who} criou ${p.count} tarefas`;
    case 'member_joined':
      return `${who} entrou no projeto`;
    case 'comment_added':
      return `${who} comentou em "${p.title}"`;
    case 'assignee_claimed':
      return `${who} vinculou @${p.name}`;
    case 'boss_started':
      return `${who} chamou ${p.icon ?? ''} ${p.name} para a briga (prazo ${String(p.deadline ?? '')
        .split('-')
        .reverse()
        .slice(0, 2)
        .join('/')})`;
    case 'boss_defeated':
      return `⚔️ ${p.name} foi derrotado!`;
    default:
      return `${who} mexeu no projeto`;
  }
}

/** Feed do clã: sem títulos de tarefas (as pastas de cada um são particulares). */
export function describeClanActivity(a: {
  action: string;
  payload: unknown;
  actor: { display_name: string } | null;
}) {
  const p = (a.payload ?? {}) as Record<string, string | undefined>;
  const who = a.actor?.display_name || 'Alguém';
  switch (a.action) {
    case 'joined':
      return `${who} entrou no clã`;
    case 'left':
      return `${who} saiu do clã`;
    case 'boss_defeated':
      return `⚔️ ${who} deu o golpe final em ${p.name}!`;
    case 'achievement':
      return `${p.icon ?? '🏅'} ${who} conquistou "${p.name}"`;
    default:
      return `${who} fez algo`;
  }
}
