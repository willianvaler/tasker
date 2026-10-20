// Reações nas tarefas concluídas e nos comentários (PB2, D222). Lista fixa, igual ao check do banco.

export const REACTIONS = ['👏', '🔥', '💪', '❤️', '🎉'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export type Reaction = {
  id: string;
  task_id: string;
  comment_id: string | null;
  user_id: string;
  emoji: string;
};

/** Alvo de uma reação: a tarefa (comment_id nulo) ou um comentário dela. */
export type ReactionTarget = { taskId: string; commentId?: string | null };

const sameTarget = (r: Reaction, target: ReactionTarget) =>
  r.task_id === target.taskId && (r.comment_id ?? null) === (target.commentId ?? null);

/** Contagem por emoji do alvo, na ordem da lista, só os que alguém usou. */
export function summarize(reactions: Reaction[], target: ReactionTarget, me: string | undefined) {
  const mine = reactions.filter((r) => sameTarget(r, target));
  return REACTIONS.map((emoji) => {
    const of = mine.filter((r) => r.emoji === emoji);
    return { emoji, count: of.length, mine: !!me && of.some((r) => r.user_id === me) };
  }).filter((s) => s.count > 0);
}

/** Lista depois de ligar ou desligar a minha reação (para a tela mudar antes da resposta). */
export function toggled(
  reactions: Reaction[],
  target: ReactionTarget,
  emoji: string,
  me: string,
  id: string,
): Reaction[] {
  const existing = reactions.find(
    (r) => sameTarget(r, target) && r.emoji === emoji && r.user_id === me,
  );
  if (existing) return reactions.filter((r) => r !== existing);
  return [
    ...reactions,
    { id, task_id: target.taskId, comment_id: target.commentId ?? null, user_id: me, emoji },
  ];
}
