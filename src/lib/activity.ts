import { tr } from './i18n-ref';
import type { Activity } from './queries/projects';

// Frases do feed do projeto e do clã (no idioma do app, F3).

const someone = () => tr('common.someone');

/** "Cris concluiu Comprar cerveja". */
export function describeActivity(a: Pick<Activity, 'action' | 'payload' | 'actor'>) {
  const p = (a.payload ?? {}) as Record<string, string | number | undefined>;
  const who = a.actor?.display_name || someone();
  switch (a.action) {
    case 'task_completed':
      return tr('activity.completed', { who, title: p.title });
    case 'tasks_created':
      return p.count === 1 && p.title
        ? tr('activity.createdOne', { who, title: p.title })
        : tr('activity.createdMany', { who, count: Number(p.count ?? 0) });
    case 'member_joined':
      return tr('activity.joined', { who });
    case 'comment_added':
      return tr('activity.commented', { who, title: p.title });
    case 'assignee_claimed':
      return tr('activity.claimed', { who, name: p.name });
    case 'boss_started':
      return tr('activity.bossStarted', {
        who,
        boss: `${p.icon ?? ''} ${p.name}`.trim(),
        deadline: String(p.deadline ?? '')
          .split('-')
          .reverse()
          .slice(0, 2)
          .join('/'),
      });
    case 'boss_defeated':
      return tr('activity.bossDefeated', { name: p.name });
    default:
      return tr('activity.other', { who });
  }
}

/** Feed do clã: sem títulos de tarefas (as pastas de cada um são particulares). */
export function describeClanActivity(a: {
  action: string;
  payload: unknown;
  actor: { display_name: string } | null;
}) {
  const p = (a.payload ?? {}) as Record<string, string | undefined>;
  const who = a.actor?.display_name || someone();
  switch (a.action) {
    case 'joined':
      return tr('activity.clanJoined', { who });
    case 'left':
      return tr('activity.clanLeft', { who });
    case 'boss_defeated':
      return tr('activity.clanFinal', { who, name: p.name });
    case 'achievement':
      return tr('activity.clanAchievement', { who, icon: p.icon ?? '🏅', name: p.name });
    default:
      return tr('activity.clanOther', { who });
  }
}
