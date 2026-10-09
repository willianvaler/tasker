import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, Text, View } from 'react-native';

import { folderLabel } from '@/components/folder-cards';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import {
  inviteUrl,
  pendingNamesOf,
  useAssignees,
  useFolderRole,
  useInviteMutations,
  useMemberMutations,
  useMembers,
  type Member,
  type Role,
} from '@/lib/queries/projects';
import { findFolder, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const ROLE_LABEL: Record<Role, string> = { owner: 'Dono', editor: 'Editor', viewer: 'Leitor' };

// Compartilhar a pasta (vira projeto): link de convite, membros e papéis, nomes pendentes.
export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const { session } = useSession();
  const online = useIsOnline();
  const toast = useToast();
  const folder = findFolder(tree.data, id)?.folder;
  const role = useFolderRole(id);
  const members = useMembers(id);
  const assignees = useAssignees();
  const invites = useInviteMutations(id);
  const m = useMemberMutations(id);
  const [inviteRole, setInviteRole] = useState<Exclude<Role, 'owner'>>('editor');
  const [link, setLink] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [confirm, setConfirm, closeConfirm] = useDialog<{ member: Member; leaving: boolean }>();

  const isOwner = role === 'owner';
  const canInvite = role === 'owner' || role === 'editor';
  const folderIds = folder
    ? [folder.id, ...('children' in folder ? folder.children.map((c) => c.id) : [])]
    : [];
  const pending = pendingNamesOf(assignees.data, folderIds);
  const onError = (err: Error) => toast({ message: `Não deu certo: ${err.message}` });

  function generate(nextRole = inviteRole) {
    invites.create.mutate(nextRole, {
      onSuccess: (token) => setLink(inviteUrl(token)),
      onError,
    });
  }

  async function copy() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    toast({ message: 'Link copiado' });
  }

  if (tree.data && (!folder || folder.parent_id || folder.is_inbox)) {
    return (
      <Screen>
        <ScreenHeader title="Compartilhar" back />
        <Text className="mt-6 text-muted-foreground">Só pastas raiz podem ser compartilhadas.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={folder ? `Compartilhar ${folderLabel(folder)}` : 'Compartilhar'} back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-12">
        {canInvite && (
          <View className="gap-2">
            <Text className="font-semibold text-foreground">Link de convite</Text>
            <Text className="text-sm text-muted-foreground">
              Quem abrir o link entra no projeto (cria a conta se precisar). Vale 14 dias.
            </Text>
            <View className="flex-row gap-2">
              {(['editor', 'viewer'] as const).map((r) => (
                <Chip
                  key={r}
                  role="radio"
                  label={r === 'editor' ? 'Pode editar' : 'Só vê e comenta'}
                  selected={inviteRole === r}
                  onPress={() => {
                    setInviteRole(r);
                    if (link) generate(r);
                  }}
                />
              ))}
            </View>
            {link ? (
              <>
                <Text
                  selectable
                  accessibilityLabel="Link de convite"
                  className="rounded-lg border border-border bg-card p-3 text-sm text-foreground"
                >
                  {link}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button label="Copiar link" onPress={copy} />
                  {Platform.OS !== 'web' && (
                    <Button
                      variant="outline"
                      label="Enviar…"
                      onPress={() =>
                        Share.share({ message: `Bora organizar ${folder?.name}? ${link}` })
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    label="Cancelar este link"
                    disabled={!online}
                    onPress={() =>
                      invites.revoke.mutate(undefined, {
                        onSuccess: () => {
                          setLink(null);
                          toast({ message: 'Link cancelado. Gere outro quando quiser.' });
                        },
                        onError,
                      })
                    }
                  />
                </View>
              </>
            ) : (
              <Button
                label="Gerar link de convite"
                loading={invites.create.isPending}
                disabled={!online}
                onPress={() => generate()}
              />
            )}
          </View>
        )}

        <View className="gap-2">
          <Text className="font-semibold text-foreground">
            Pessoas ({members.data?.length ?? '…'})
          </Text>
          {members.data?.map((member) => {
            const me = member.userId === session?.user.id;
            return (
              <View key={member.userId} className="gap-2 rounded-xl border border-border p-3">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base text-foreground">
                    {member.displayName}
                    {me ? ' (você)' : ''}
                  </Text>
                  <Text className="text-sm text-muted-foreground">{ROLE_LABEL[member.role]}</Text>
                </View>
                {member.aliases.length > 0 && (
                  <Text className="text-xs text-muted-foreground">
                    Também é {member.aliases.map((a) => `@${a}`).join(', ')}
                  </Text>
                )}
                {isOwner && member.role !== 'owner' && online && (
                  <View className="flex-row flex-wrap gap-2">
                    {(['editor', 'viewer'] as const).map((r) => (
                      <Chip
                        key={r}
                        role="radio"
                        label={ROLE_LABEL[r]}
                        selected={member.role === r}
                        onPress={() =>
                          m.setRole.mutate({ userId: member.userId, role: r }, { onError })
                        }
                      />
                    ))}
                    <Button
                      variant="ghost"
                      label="Tirar do projeto"
                      onPress={() => setConfirm({ member, leaving: false })}
                    />
                  </View>
                )}
                {me && member.role !== 'owner' && online && (
                  <Button
                    variant="ghost"
                    className="self-start"
                    label="Sair do projeto"
                    onPress={() => setConfirm({ member, leaving: true })}
                  />
                )}
              </View>
            );
          })}
        </View>

        {pending.length > 0 && (
          <View className="gap-2">
            <Text className="font-semibold text-foreground">Nomes pendentes</Text>
            <Text className="text-sm text-muted-foreground">
              Tarefas atribuídas a quem ainda não entrou. Quem entra pelo link escolhe o próprio
              nome; você também pode vincular agora.
            </Text>
            {pending.map((name) => (
              <View key={name} className="gap-2 rounded-xl border border-dashed border-border p-3">
                <View className="flex-row items-center">
                  <Text className="flex-1 text-base text-foreground">@{name}</Text>
                  {canInvite && online && (
                    <Button
                      variant="ghost"
                      label={linking === name ? 'Fechar' : 'Vincular a…'}
                      onPress={() => setLinking(linking === name ? null : name)}
                    />
                  )}
                </View>
                {linking === name && (
                  <View className="flex-row flex-wrap gap-2">
                    {members.data?.map((member) => (
                      <Chip
                        key={member.userId}
                        label={member.displayName}
                        onPress={() =>
                          m.claim.mutate(
                            { name, userId: member.userId },
                            {
                              onSuccess: () => {
                                setLinking(null);
                                toast({ message: `@${name} agora é ${member.displayName}` });
                              },
                              onError,
                            },
                          )
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {confirm && (
        <ConfirmDialog
          title={
            confirm.leaving
              ? `Sair de "${folder?.name}"?`
              : `Tirar ${confirm.member.displayName} do projeto?`
          }
          message="As tarefas atribuídas voltam a ficar com o nome da pessoa, pendente."
          confirmLabel={confirm.leaving ? 'Sair' : 'Tirar'}
          onClose={closeConfirm}
          onConfirm={() => {
            const { member, leaving } = confirm;
            closeConfirm();
            m.remove.mutate(member.userId, {
              onError,
              onSuccess: () => {
                if (leaving) router.replace('/folders');
              },
            });
          }}
        />
      )}
    </Screen>
  );
}
