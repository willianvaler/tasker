import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/person';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { MentionResolution } from '@/lib/members';
import { actorCan } from '@/lib/permissions';
import {
  assigneesOf,
  rootFolder,
  useAssigneeMutations,
  useAssignees,
  useFolderActor,
  useMembers,
  type Assignee,
  type Member,
} from '@/lib/queries/projects';
import { useTree } from '@/lib/queries/tree';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

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
 * reivindicar.
 */
export function AssigneeChips({ taskId, folderId }: { taskId: string; folderId: string }) {
  const all = useAssignees();
  const members = useTaskMembers(folderId);
  const { t } = useTranslation();
  const assignees = assigneesOf(all.data, taskId);
  if (assignees.length === 0) return null;
  const label = assignees
    .map((a) =>
      a.pending_name ? t('task.pending', { name: a.pending_name }) : assigneeName(a, members),
    )
    .join(', ');
  return (
    <View
      className="flex-row flex-wrap items-center gap-1"
      accessibilityLabel={t('task.assignees', { names: label })}
    >
      {assignees.map((a) =>
        a.pending_name ? (
          <Text
            key={a.id}
            className="rounded border border-dashed border-ink-muted px-1 text-xs text-ink-muted"
          >
            @{a.pending_name}
          </Text>
        ) : (
          <Avatar key={a.id} name={assigneeName(a, members)} />
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
            <Text className="text-xs text-danger">@{m.name}: quem?</Text>
            {m.candidates.map((c) => (
              <Pressable
                key={c.userId}
                accessibilityRole="button"
                accessibilityLabel={`@${m.name} é ${c.displayName}`}
                className="min-h-8 justify-center rounded-full border border-line px-2 active:bg-wash"
                onPress={() => onChoose(m.name, c.userId)}
              >
                <Text className="text-xs text-ink">{c.displayName}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text
            key={m.name}
            className={cn(
              'rounded-full border px-2 text-xs',
              m.kind === 'member'
                ? 'border-accent text-accent'
                : 'border-dashed border-ink-muted text-ink-muted',
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

/**
 * "Eu levo" (M2, D139): tarefa de projeto sem responsável, para quem pode criar tarefas. Quem
 * chega depois de outra pessoa é recusado pelo servidor.
 */
export function ClaimButton({ task }: { task: { id: string; title: string; folder_id: string } }) {
  const { t } = useTranslation();
  const tree = useTree();
  const root = rootFolder(tree.data, task.folder_id);
  const all = useAssignees();
  const actor = useFolderActor(task.folder_id);
  const { session } = useSession();
  const { add } = useAssigneeMutations();
  const toast = useToast();
  const userId = session?.user.id;
  if (!root || root.kind !== 'project' || !userId) return null;
  if (!all.data || assigneesOf(all.data, task.id).length > 0) return null;
  if (!actorCan(actor, 'task.create')) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('claim.label', { title: task.title })}
      onPress={() =>
        add.mutate(
          { taskId: task.id, userId },
          {
            onSuccess: () => toast({ message: t('claim.done', { title: task.title }) }),
            onError: () => toast({ message: t('claim.taken') }),
          },
        )
      }
      className="h-7 items-center justify-center rounded border border-dashed border-line px-2 hover:bg-wash active:bg-wash"
    >
      <Text className="text-xs text-ink">{t('claim.button')}</Text>
    </Pressable>
  );
}

/** "Aprovação · Ana" na linha da tarefa de aprovação (M7). */
export function ApprovalTag({
  task,
}: {
  task: { folder_id: string; approver_id: string | null; approver_role: string | null };
}) {
  const { t } = useTranslation();
  const members = useTaskMembers(task.folder_id);
  if (!task.approver_id && !task.approver_role) return null;
  const who = task.approver_id
    ? (members?.find((m) => m.userId === task.approver_id)?.displayName ?? '—')
    : t(task.approver_role === 'owner' ? 'approval.owner' : 'approval.manager');
  return (
    <Text className="text-xs text-accent" numberOfLines={1}>
      {t('approval.tag', { who })}
    </Text>
  );
}

/** Painel: quem aprova (nenhum, Gerente, só o Dono ou uma pessoa do projeto). */
export function ApprovalEditor({
  task,
  disabled,
  onChange,
}: {
  task: { folder_id: string; approver_id: string | null; approver_role: string | null };
  disabled?: boolean;
  onChange: (patch: { approver_id: string | null; approver_role: string | null }) => void;
}) {
  const { t } = useTranslation();
  const members = useTaskMembers(task.folder_id) ?? [];
  const options: {
    key: string;
    label: string;
    patch: { approver_id: string | null; approver_role: string | null };
  }[] = [
    { key: 'none', label: t('approval.none'), patch: { approver_id: null, approver_role: null } },
    {
      key: 'manager',
      label: t('approval.manager'),
      patch: { approver_id: null, approver_role: 'manager' },
    },
    {
      key: 'owner',
      label: t('approval.owner'),
      patch: { approver_id: null, approver_role: 'owner' },
    },
    ...members.map((m) => ({
      key: m.userId,
      label: m.displayName,
      patch: { approver_id: m.userId, approver_role: null },
    })),
  ];
  const current = task.approver_id ?? task.approver_role ?? 'none';
  return (
    <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup">
      {options.map((o) => (
        <Pressable
          key={o.key}
          accessibilityRole="radio"
          aria-checked={current === o.key}
          aria-disabled={disabled}
          disabled={disabled}
          onPress={() => onChange(o.patch)}
          className={cn(
            'min-h-8 justify-center rounded border px-2',
            current === o.key ? 'border-accent bg-wash' : 'border-line',
          )}
        >
          <Text className="text-sm text-ink">{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
