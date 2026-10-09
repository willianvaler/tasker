import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { assigneeName, useTaskMembers } from '@/components/tasks/assignee-chips';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
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
  const onError = (err: Error) => toast({ message: `Não deu certo: ${err.message}` });

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
      {current.length === 0 && (
        <Text className="text-sm text-muted-foreground">Ninguém ainda.</Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {current.map((a) => (
          <Chip
            key={a.id}
            selected
            disabled={!writable}
            label={`${assigneeName(a, members)}${a.pending_name ? ' (pendente)' : ''}  ✕`}
            onPress={() => m.remove.mutate(a.id, { onError })}
          />
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
          placeholder="Outro nome (fica pendente até a pessoa entrar)"
          accessibilityLabel="Novo responsável"
        />
      )}
    </View>
  );
}

const WHEN = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Comentários em ordem cronológica; @nome avisa o membro (ESCOPO 4.5). Leitor também comenta. */
export function Comments({ task }: { task: Task }) {
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
      { onError: (err) => toast({ message: `Não deu para comentar: ${err.message}` }) },
    );
    setBody('');
  }

  return (
    <View className="gap-3">
      {comments.data?.length === 0 && (
        <Text className="text-sm text-muted-foreground">Nenhum comentário.</Text>
      )}
      {comments.data?.map((c) => {
        const author =
          c.author?.display_name ??
          members?.find((mem) => mem.userId === c.author_id)?.displayName ??
          'Você';
        return (
          <View key={c.id} className="gap-1 rounded-lg bg-muted p-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm font-semibold text-foreground">{author}</Text>
              <Text className="text-xs text-muted-foreground">
                {WHEN.format(new Date(c.created_at))}
              </Text>
              {c.author_id === session?.user.id && online && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apagar comentário"
                  className="h-8 w-8 items-center justify-center rounded-full active:bg-background"
                  onPress={() => m.remove.mutate(c.id)}
                >
                  <Text className="text-muted-foreground">✕</Text>
                </Pressable>
              )}
            </View>
            <Text className="text-base text-foreground">{c.body}</Text>
          </View>
        );
      })}
      <Input
        value={body}
        onChangeText={setBody}
        onSubmitEditing={send}
        submitBehavior="submit"
        editable={online}
        placeholder="Comentar… (@nome avisa a pessoa)"
        accessibilityLabel="Novo comentário"
      />
    </View>
  );
}
