import { randomUUID } from 'expo-crypto';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { assigneeName, useTaskMembers } from '@/components/tasks/assignee-chips';
import { IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/person';
import { Text } from '@/components/ui/text';
import { nameKey } from '@/lib/members';
import {
  assigneesOf,
  pendingNamesOf,
  rootFolder,
  useAssigneeMutations,
  useAssignees,
  useCommentMutations,
  useComments,
} from '@/lib/queries/projects';
import type { Task } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/** Responsáveis da tarefa: membros, nomes pendentes do projeto ou um nome novo (pendente). */
export function AssigneesEditor({ task }: { task: Task }) {
  const { t } = useTranslation();
  const writable = useCanWrite(task.folder_id);
  const tree = useTree();
  const all = useAssignees();
  const members = useTaskMembers(task.folder_id);
  const m = useAssigneeMutations();
  const toast = useToast();
  const [name, setName] = useState('');

  const root = rootFolder(tree.data, task.folder_id);
  const folderIds = root ? [root.id, ...root.children.map((c) => c.id)] : [];
  const current = assigneesOf(all.data, task.id);
  const onError = (err: Error) => toast({ message: t('collab.error', { message: err.message }) });

  const freeMembers = (members ?? []).filter(
    (mem) => !current.some((a) => a.user_id === mem.userId),
  );
  const freePending = pendingNamesOf(all.data, folderIds).filter(
    (n) => !current.some((a) => a.pending_name && nameKey(a.pending_name) === nameKey(n)),
  );

  function addPending() {
    const trimmed = name.trim().replace(/^@/, '');
    if (!trimmed) return;
    m.add.mutate({ taskId: task.id, pendingName: trimmed }, { onError });
    setName('');
  }

  return (
    <View className="gap-2">
      {current.length === 0 && <Text className="text-sm text-ink-muted">{t('collab.nobody')}</Text>}
      <View>
        {current.map((a) => (
          <View key={a.id} className="min-h-10 flex-row items-center gap-2 border-b border-line">
            <Avatar name={assigneeName(a, members)} />
            <Text className="flex-1 text-sm text-ink">
              {assigneeName(a, members)}
              {a.pending_name ? ` ${t('collab.pending')}` : ''}
            </Text>
            {writable && (
              <IconButton
                icon={X}
                label={t('collab.remove', { name: assigneeName(a, members) })}
                onPress={() => m.remove.mutate(a.id, { onError })}
              />
            )}
          </View>
        ))}
      </View>
      {writable && (freeMembers.length > 0 || freePending.length > 0) && (
        <View className="flex-row flex-wrap gap-2">
          {freeMembers.map((mem) => (
            <Chip
              key={mem.userId}
              label={`+ ${mem.displayName}`}
              onPress={() => m.add.mutate({ taskId: task.id, userId: mem.userId }, { onError })}
            />
          ))}
          {freePending.map((n) => (
            <Chip
              key={n}
              label={`+ @${n}`}
              onPress={() => m.add.mutate({ taskId: task.id, pendingName: n }, { onError })}
            />
          ))}
        </View>
      )}
      {writable && (
        <Input
          value={name}
          onChangeText={setName}
          onSubmitEditing={addPending}
          submitBehavior="submit"
          autoCapitalize="none"
          placeholder={t('collab.newPlaceholder')}
          accessibilityLabel={t('collab.newLabel')}
        />
      )}
    </View>
  );
}

/** Comentários em ordem cronológica; @nome avisa o membro (ESCOPO 4.5). Leitor também comenta. */
export function Comments({ task }: { task: Task }) {
  const { t, i18n } = useTranslation();
  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const online = useIsOnline();
  const { session } = useSession();
  const comments = useComments(task.id);
  const m = useCommentMutations(task.id);
  const members = useTaskMembers(task.folder_id);
  const toast = useToast();
  const [body, setBody] = useState('');

  function send() {
    const trimmed = body.trim();
    if (!trimmed || !online) return;
    m.add.mutate(
      { id: randomUUID(), body: trimmed },
      { onError: (err) => toast({ message: t('collab.commentError', { message: err.message }) }) },
    );
    setBody('');
  }

  return (
    <View className="gap-3">
      {comments.data?.length === 0 && (
        <Text className="text-sm text-ink-muted">{t('collab.noComments')}</Text>
      )}
      {comments.data?.map((c) => {
        const author =
          c.author?.display_name ??
          members?.find((mem) => mem.userId === c.author_id)?.displayName ??
          t('collab.you');
        return (
          <View key={c.id} className="gap-1 border-l-2 border-line pl-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm font-semibold text-ink">{author}</Text>
              <Text className="font-mono text-xs text-ink-muted">
                {when.format(new Date(c.created_at))}
              </Text>
              {c.author_id === session?.user.id && online && (
                <IconButton
                  icon={X}
                  label={t('collab.deleteComment')}
                  onPress={() => m.remove.mutate(c.id)}
                />
              )}
            </View>
            <Text className="text-sm text-ink">{c.body}</Text>
          </View>
        );
      })}
      <Input
        value={body}
        onChangeText={setBody}
        onSubmitEditing={send}
        submitBehavior="submit"
        editable={online}
        placeholder={t('collab.commentPlaceholder')}
        accessibilityLabel={t('collab.newComment')}
      />
    </View>
  );
}
