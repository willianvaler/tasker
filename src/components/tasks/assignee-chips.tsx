import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { initials, type MentionResolution } from '@/lib/members';
import {
  assigneesOf,
  rootFolder,
  useAssignees,
  useMembers,
  type Assignee,
  type Member,
} from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';

/** Nome do responsável: o do membro ou "@nome" (pendente). */
export function assigneeName(a: Assignee, members: Member[] | undefined) {
  if (a.pending_name) return `@${a.pending_name}`;
  return members?.find((m) => m.userId === a.user_id)?.displayName ?? 'Alguém';
}

/** Membros do projeto da tarefa (só em pasta compartilhada; senão, nada é consultado). */
export function useTaskMembers(folderId: string | undefined) {
  const tree = useTree();
  const root = rootFolder(tree.data, folderId);
  return useMembers(root?.is_shared ? root.id : undefined).data;
}

/**
 * Responsáveis na linha da tarefa: iniciais do membro; nome pendente tracejado até alguém
 * reivindicar (ESCOPO 4.5).
 */
export function AssigneeChips({ taskId, folderId }: { taskId: string; folderId: string }) {
  const all = useAssignees();
  const members = useTaskMembers(folderId);
  const assignees = assigneesOf(all.data, taskId);
  if (assignees.length === 0) return null;
  const label = assignees
    .map((a) => (a.pending_name ? `@${a.pending_name} (pendente)` : assigneeName(a, members)))
    .join(', ');
  return (
    <View className="flex-row flex-wrap gap-1" accessibilityLabel={`Responsáveis: ${label}`}>
      {assignees.map((a) =>
        a.pending_name ? (
          <Text
            key={a.id}
            className="rounded-full border border-dashed border-muted-foreground px-2 text-xs text-muted-foreground"
          >
            @{a.pending_name}
          </Text>
        ) : (
          <View
            key={a.id}
            className="h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1"
          >
            <Text className="text-[10px] font-bold text-primary-foreground">
              {initials(assigneeName(a, members))}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

/** Prévia do lote: como cada @nome vai ficar. Ambíguo: escolha entre os candidatos. */
export function MentionChips({
  mentions,
  onChoose,
}: {
  mentions: MentionResolution[];
  onChoose: (name: string, userId: string) => void;
}) {
  if (mentions.length === 0) return null;
  return (
    <View className="mt-1 flex-row flex-wrap items-center gap-1">
      {mentions.map((m) =>
        m.kind === 'ambiguous' ? (
          <View key={m.name} className="flex-row flex-wrap items-center gap-1">
            <Text className="text-xs text-destructive">@{m.name}: quem?</Text>
            {m.candidates.map((c) => (
              <Pressable
                key={c.userId}
                accessibilityRole="button"
                accessibilityLabel={`@${m.name} é ${c.displayName}`}
                className="min-h-8 justify-center rounded-full border border-border px-2 active:bg-muted"
                onPress={() => onChoose(m.name, c.userId)}
              >
                <Text className="text-xs text-foreground">{c.displayName}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text
            key={m.name}
            className={cn(
              'rounded-full border px-2 text-xs',
              m.kind === 'member'
                ? 'border-primary text-primary'
                : 'border-dashed border-muted-foreground text-muted-foreground',
            )}
          >
            @{m.name}
            {m.kind === 'pending' ? ' · pendente' : ' ✓'}
          </Text>
        ),
      )}
    </View>
  );
}
