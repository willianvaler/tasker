import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Copy, Link2, LogOut, Send, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Share, View } from 'react-native';

import { folderLabel } from '@/components/folder-cards';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
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
import { Text } from '@/components/ui/text';
import { roleCan } from '@/lib/permissions';
import { findFolder, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const ROLE_LABEL = {
  owner: 'share.roleOwner',
  editor: 'share.roleEditor',
  viewer: 'share.roleViewer',
} as const satisfies Record<Role, string>;

// Compartilhar a pasta (vira projeto): link de convite, membros e papéis, nomes pendentes.
export default function ShareScreen() {
  const { t } = useTranslation();
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

  // Mudar papéis e remover pessoas (V2 §4.3: member.manage). Convidar continua aberto ao editor
  // até os cargos novos (Fase E)
  const isOwner = roleCan(role, 'member.manage');
  const canInvite = role === 'owner' || role === 'editor';
  const folderIds = folder
    ? [folder.id, ...('children' in folder ? folder.children.map((c) => c.id) : [])]
    : [];
  const pending = pendingNamesOf(assignees.data, folderIds);
  const onError = (err: Error) => toast({ message: t('share.error', { message: err.message }) });

  function generate(nextRole = inviteRole) {
    invites.create.mutate(nextRole, {
      onSuccess: (token) => setLink(inviteUrl(token)),
      onError,
    });
  }

  async function copy() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    toast({ message: t('share.copied') });
  }

  if (tree.data && (!folder || folder.parent_id || folder.is_inbox)) {
    return (
      <Screen>
        <ScreenHeader title={t('share.title')} back />
        <EmptyState title={t('share.rootOnly')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={folder ? folderLabel(folder) : t('share.title')}
        eyebrow={t('share.title')}
        back
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-8 pb-12">
        {canInvite && (
          <View className="gap-3">
            <SectionLabel title={t('share.link')} className="pt-0" />
            <Text className="text-sm text-ink-muted">{t('share.linkHint')}</Text>
            <View className="flex-row gap-2" accessibilityRole="radiogroup">
              {(['editor', 'viewer'] as const).map((r) => (
                <Chip
                  key={r}
                  role="radio"
                  label={t(r === 'editor' ? 'share.canEdit' : 'share.viewOnly')}
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
                  accessibilityLabel={t('share.link')}
                  className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
                >
                  {link}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Button icon={Copy} label={t('share.copy')} onPress={copy} />
                  {Platform.OS !== 'web' && (
                    <Button
                      variant="ghost"
                      icon={Send}
                      label={t('share.send')}
                      onPress={() =>
                        Share.share({
                          message: t('share.sendMessage', { name: folder?.name ?? '', link }),
                        })
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    icon={X}
                    label={t('share.revoke')}
                    disabled={!online}
                    onPress={() =>
                      invites.revoke.mutate(undefined, {
                        onSuccess: () => {
                          setLink(null);
                          toast({ message: t('share.revoked') });
                        },
                        onError,
                      })
                    }
                  />
                </View>
              </>
            ) : (
              <Button
                icon={Link2}
                className="self-start"
                label={t('share.generate')}
                loading={invites.create.isPending}
                disabled={!online}
                onPress={() => generate()}
              />
            )}
          </View>
        )}

        <View>
          <SectionLabel title={t('share.people')} count={members.data?.length} className="pt-0" />
          {members.data?.map((member) => {
            const me = member.userId === session?.user.id;
            return (
              <View key={member.userId} className="gap-2 border-b border-line py-3">
                <View className="flex-row items-center gap-3">
                  <Avatar name={member.displayName} size={32} />
                  <View className="flex-1">
                    <Text className="text-sm text-ink">
                      {member.displayName}
                      {me ? ` ${t('share.you')}` : ''}
                    </Text>
                    {member.aliases.length > 0 && (
                      <Text className="text-xs text-ink-muted">
                        {t('share.aliases', {
                          names: member.aliases.map((a) => `@${a}`).join(', '),
                        })}
                      </Text>
                    )}
                  </View>
                  <Text className="font-mono text-xs text-ink-muted">
                    {t(ROLE_LABEL[member.role])}
                  </Text>
                </View>
                {isOwner && member.role !== 'owner' && online && (
                  <View className="flex-row flex-wrap gap-2">
                    {(['editor', 'viewer'] as const).map((r) => (
                      <Chip
                        key={r}
                        role="radio"
                        label={t(ROLE_LABEL[r])}
                        selected={member.role === r}
                        onPress={() =>
                          m.setRole.mutate({ userId: member.userId, role: r }, { onError })
                        }
                      />
                    ))}
                    <Button
                      variant="ghost"
                      label={t('share.remove')}
                      onPress={() => setConfirm({ member, leaving: false })}
                    />
                  </View>
                )}
                {me && member.role !== 'owner' && online && (
                  <Button
                    variant="ghost"
                    className="self-start"
                    icon={LogOut}
                    label={t('share.leave')}
                    onPress={() => setConfirm({ member, leaving: true })}
                  />
                )}
              </View>
            );
          })}
        </View>

        {pending.length > 0 && (
          <View className="gap-2">
            <SectionLabel title={t('share.pending')} count={pending.length} className="pt-0" />
            <Text className="text-sm text-ink-muted">{t('share.pendingHint')}</Text>
            {pending.map((name) => (
              <View key={name} className="gap-2 border-b border-line py-2">
                <View className="flex-row items-center">
                  <Text className="flex-1 font-mono text-sm text-ink">@{name}</Text>
                  {canInvite && online && (
                    <Button
                      variant="ghost"
                      label={linking === name ? t('common.close') : t('share.link_to')}
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
                                toast({
                                  message: t('share.linked', { name, member: member.displayName }),
                                });
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
              ? t('share.leaveTitle', { name: folder?.name ?? '' })
              : t('share.removeTitle', { name: confirm.member.displayName })
          }
          message={t('share.removeMessage')}
          confirmLabel={t(confirm.leaving ? 'share.leaveConfirm' : 'share.removeConfirm')}
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
