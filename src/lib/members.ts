// Casar "@nome" com membros do projeto (ESCOPO 4.5). Espelho de public.name_key e
// public.members_matching (migração da Fase 4), com os mesmos casos de teste.

/** "Ana Lima" → "analima"; "@Grégory" → "gregory". */
export function nameKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export type MemberName = { userId: string; displayName: string; aliases: string[] };

/** Nome inteiro, primeiro nome ou apelido (nome pendente que a pessoa já reivindicou). */
export function memberMatches(name: string, member: MemberName) {
  const key = nameKey(name);
  if (!key) return false;
  const firstName = member.displayName.trim().split(/\s+/)[0] ?? '';
  return (
    nameKey(member.displayName) === key ||
    nameKey(firstName) === key ||
    member.aliases.some((alias) => nameKey(alias) === key)
  );
}

export type MentionResolution =
  | { kind: 'member'; name: string; userId: string }
  | { kind: 'pending'; name: string }
  | { kind: 'ambiguous'; name: string; candidates: MemberName[] };

/**
 * Um membro compatível: atribui. Nenhum: responsável pendente (o caso de colar a lista antes de
 * convidar). Mais de um: não atribui, e a pré-visualização pergunta quem é.
 */
export function resolveMention(name: string, members: MemberName[]): MentionResolution {
  const candidates = members.filter((m) => memberMatches(name, m));
  if (candidates.length === 1) return { kind: 'member', name, userId: candidates[0].userId };
  if (candidates.length === 0) return { kind: 'pending', name };
  return { kind: 'ambiguous', name, candidates };
}

/** Responsáveis no formato do create_tasks_batch. Ambíguos ficam de fora. */
export function toAssignees(resolutions: MentionResolution[]) {
  const out: ({ user_id: string } | { pending_name: string })[] = [];
  for (const r of resolutions) {
    if (r.kind === 'member') {
      if (!out.some((a) => 'user_id' in a && a.user_id === r.userId))
        out.push({ user_id: r.userId });
    } else if (r.kind === 'pending') {
      if (!out.some((a) => 'pending_name' in a && nameKey(a.pending_name) === nameKey(r.name)))
        out.push({ pending_name: r.name });
    }
  }
  return out;
}

/** Iniciais para o avatar ("Ana Lima" → "AL"). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}
