import * as Clipboard from 'expo-clipboard';
import { Link, router, useLocalSearchParams } from 'expo-router';
import {
  Copy,
  FolderPlus,
  Import,
  Link2,
  LogOut,
  Mail,
  Pencil,
  Trash2,
  Trophy,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { ItemIcon } from '@/components/item-icon';
import { RoleEditor } from '@/components/role-editor';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ActionMenu, ConfirmDialog, PromptDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PersonRow } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { inviteUrl } from '@/lib/queries/projects';
import {
  describeAudit,
  TEAM_ROLE_HINT,
  TEAM_ROLE_LABEL,
  teamRoleAtLeast,
  useTeam,
  useTeamAdmin,
  useTeamMutations,
  useTeamRoleMutations,
  useTeamRoles,
  type TeamMember,
  type TeamRole,
} from '@/lib/queries/teams';
import { useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const DAYS = [1, 7, 14, 30] as const;
const USES = [1, 10, 50] as const;

export default function TeamScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = useTeam(id);
  const myRole = team.data?.myRole;
  const isAdmin = teamRoleAtLeast(myRole, 'admin');
  const isOwner = myRole === 'owner';
  const admin = useTeamAdmin(id, isAdmin);
  const m = useTeamMutations(id);
  const roles = useTeamRoles(id);
  const roleMutations = useTeamRoleMutations(id);
  // 'new' ou o id do cargo em edição
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [deletingRole, setDeletingRole, closeDeletingRole] = useDialog<{
    id: string;
    name: string;
  }>();
  const tree = useTree();
  const { session } = useSession();
  const online = useIsOnline();
  const toast = useToast();
  const [inviteRole, setInviteRole] = useState<Exclude<TeamRole, 'owner'>>('member');
  const [days, setDays] = useState<number>(14);
  const [uses, setUses] = useState<number>(50);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [bringing, setBringing] = useState(false);
  const [removing, setRemoving, closeRemoving] = useDialog<TeamMember>();
  const [deleting, setDeleting, closeDeleting] = useDialog<true>();
  const onError = (err: Error) => toast({ message: t('team.error', { message: err.message }) });
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' });
  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (team.isPending) return <Screen>{null}</Screen>;
  if (!team.data) {
    return (
      <Screen>
        <ScreenHeader title={t('team.title')} back />
        <EmptyState title={t('team.notFound')} />
      </Screen>
    );
  }
  const data = team.data;

  // Admin muda Membro e Convidado; Dono muda todo mundo
  const editableRoles = (member: TeamMember): readonly TeamRole[] => {
    if (isOwner) return ['owner', 'admin', 'member', 'guest'];
    if (isAdmin && !teamRoleAtLeast(member.role, 'admin')) return ['member', 'guest'];
    return [];
  };
  const inviteRoles: Exclude<TeamRole, 'owner'>[] = isOwner
    ? ['admin', 'member', 'guest']
    : ['member', 'guest'];
  // Projetos meus (Dono) que não estão em time nenhum
  const bringable = (tree.data?.folders ?? []).filter(
    (f) => !f.team_id && !f.parent_id && f.owner_id === session?.user.id,
  );

  function createInvite() {
    m.invite.mutate(
      { role: inviteRole, days, maxUses: uses, email: email.trim() || undefined },
      {
        onSuccess: (invite) => {
          setLink(inviteUrl(invite.token, 'team-invite'));
          if (invite.email) {
            setEmail('');
            toast({ message: t('team.emailSent') });
          }
        },
        onError,
      },
    );
  }

  async function copy(text: string) {
    await Clipboard.setStringAsync(text);
    toast({ message: t('team.copied') });
  }

  return (
    <Screen size="medium">
      <ScreenHeader
        title={data.icon ? `${data.icon} ${data.name}` : data.name}
        eyebrow={t('team.eyebrow')}
        back
        right={
          <Button
            variant="ghost"
            icon={Trophy}
            label={t('group.title')}
            onPress={() =>
              router.push({ pathname: '/grupo/[kind]/[id]', params: { kind: 'time', id: data.id } })
            }
          />
        }
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-8 pb-12">
        <View>
          <SectionLabel title={t('team.people')} count={data.members.length} className="pt-0" />
          {data.members.map((member) => {
            const me = member.userId === session?.user.id;
            const roles = me ? [] : editableRoles(member);
            return (
              <View key={member.userId} className="gap-2 pb-2">
                <PersonRow
                  name={`${member.displayName}${me ? ` ${t('team.you')}` : ''}`}
                  detail={t(TEAM_ROLE_LABEL[member.role])}
                  right={
                    me ? (
                      <Button
                        variant="ghost"
                        icon={LogOut}
                        label={t('team.leave')}
                        disabled={!online}
                        onPress={() => setRemoving(member)}
                      />
                    ) : roles.length > 0 ? (
                      <Button
                        variant="ghost"
                        label={t('team.remove')}
                        disabled={!online}
                        onPress={() => setRemoving(member)}
                      />
                    ) : null
                  }
                />
                {roles.length > 0 && online && (
                  <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                    {roles.map((r) => (
                      <Chip
                        key={r}
                        role="radio"
                        label={t(TEAM_ROLE_LABEL[r])}
                        selected={member.role === r}
                        onPress={() =>
                          m.setRole.mutate({ userId: member.userId, role: r }, { onError })
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {isAdmin && (
          <View className="gap-3">
            <SectionLabel title={t('team.invite')} className="pt-0" />
            <Text className="text-xs text-ink-muted">{t('team.inviteAs')}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {inviteRoles.map((r) => (
                <Chip
                  key={r}
                  role="radio"
                  label={t(TEAM_ROLE_LABEL[r])}
                  selected={inviteRole === r}
                  onPress={() => setInviteRole(r)}
                />
              ))}
            </View>
            <Text className="text-xs text-ink-muted">{t(TEAM_ROLE_HINT[inviteRole])}</Text>
            <Text className="text-xs text-ink-muted">{t('team.validity')}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {DAYS.map((d) => (
                <Chip
                  key={d}
                  role="radio"
                  label={t('team.days', { count: d })}
                  selected={days === d}
                  onPress={() => setDays(d)}
                />
              ))}
            </View>
            <Text className="text-xs text-ink-muted">{t('team.uses')}</Text>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {USES.map((u) => (
                <Chip
                  key={u}
                  role="radio"
                  label={t('team.usesCount', { count: u })}
                  selected={uses === u}
                  onPress={() => setUses(u)}
                />
              ))}
            </View>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder={t('team.emailPlaceholder')}
              accessibilityLabel={t('team.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              className="self-start"
              icon={email.trim() ? Mail : Link2}
              label={email.trim() ? t('team.inviteEmail') : t('team.generate')}
              loading={m.invite.isPending}
              disabled={!online}
              onPress={createInvite}
            />
            {link && (
              <>
                <Text
                  selectable
                  accessibilityLabel={t('share.link')}
                  className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
                >
                  {link}
                </Text>
                <Button
                  className="self-start"
                  icon={Copy}
                  label={t('team.copy')}
                  onPress={() => copy(link)}
                />
              </>
            )}

            {(admin.data?.invites.length ?? 0) > 0 && (
              <View>
                <SectionLabel title={t('team.activeInvites')} count={admin.data?.invites.length} />
                {admin.data?.invites.map((invite) => (
                  <View
                    key={invite.id}
                    className="flex-row items-center gap-2 border-b border-line py-2"
                  >
                    <Text className="flex-1 font-mono text-xs text-ink-muted">
                      {t('team.inviteLine', {
                        role: t(TEAM_ROLE_LABEL[invite.role]),
                        uses: invite.uses,
                        max: invite.max_uses,
                        date: date.format(new Date(invite.expires_at)),
                      })}
                      {invite.email ? ` · ${t('team.inviteFor', { email: invite.email })}` : ''}
                    </Text>
                    <Button
                      variant="ghost"
                      icon={Copy}
                      label={t('team.copy')}
                      onPress={() => copy(inviteUrl(invite.token, 'team-invite'))}
                    />
                    <Button
                      variant="ghost"
                      label={t('team.revoke')}
                      disabled={!online}
                      onPress={() => m.revokeInvite.mutate(invite.id, { onError })}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {isAdmin && (admin.data?.requests.length ?? 0) > 0 && (
          <View>
            <SectionLabel
              title={t('team.requests')}
              count={admin.data?.requests.length}
              tone="warn"
              className="pt-0"
            />
            {admin.data?.requests.map((request) => (
              <PersonRow
                key={request.id}
                name={request.displayName}
                detail={t('team.wantsToJoin', { role: t(TEAM_ROLE_LABEL[request.role]) })}
                right={
                  <View className="flex-row gap-1">
                    <Button
                      label={t('team.approve')}
                      disabled={!online}
                      onPress={() =>
                        m.decide.mutate({ requestId: request.id, approve: true }, { onError })
                      }
                    />
                    <Button
                      variant="ghost"
                      label={t('team.deny')}
                      disabled={!online}
                      onPress={() =>
                        m.decide.mutate({ requestId: request.id, approve: false }, { onError })
                      }
                    />
                  </View>
                }
              />
            ))}
          </View>
        )}

        <View className="gap-2">
          <SectionLabel title={t('team.projects')} count={data.projects.length} className="pt-0" />
          {data.projects.length === 0 && (
            <Text className="text-sm text-ink-muted">{t('team.noProjects')}</Text>
          )}
          {data.projects.map((project) => (
            <Link
              key={project.id}
              href={{ pathname: '/folder/[id]', params: { id: project.id } }}
              asChild
            >
              <Pressable
                accessibilityRole="link"
                className="min-h-11 flex-row items-center gap-3 border-b border-line web:hover:bg-wash"
              >
                <ItemIcon icon={project.icon} kind="project" size={16} />
                <Text className="flex-1 text-sm text-ink">{project.name}</Text>
              </Pressable>
            </Link>
          ))}
          <View className="flex-row flex-wrap gap-2 pt-2">
            {teamRoleAtLeast(myRole, 'member') && (
              <Button
                variant="ghost"
                icon={FolderPlus}
                label={t('team.newProject')}
                disabled={!online}
                onPress={() => setCreatingProject(true)}
              />
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                icon={Import}
                label={t('team.bringProject')}
                disabled={!online}
                onPress={() =>
                  bringable.length
                    ? setBringing(true)
                    : toast({ message: t('team.noProjectToBring') })
                }
              />
            )}
          </View>
        </View>

        {(isAdmin || (roles.data?.length ?? 0) > 0) && (
          <View className="gap-2">
            <SectionLabel title={t('team.roles')} count={roles.data?.length} className="pt-0" />
            <Text className="text-sm text-ink-muted">{t('team.rolesHint')}</Text>
            {roles.data?.map((role) =>
              editingRole === role.id ? (
                <RoleEditor
                  key={role.id}
                  initialName={role.name}
                  initialGrants={role.grants}
                  saving={roleMutations.save.isPending}
                  onCancel={() => setEditingRole(null)}
                  onSave={(next) =>
                    roleMutations.save.mutate(
                      { id: role.id, ...next },
                      { onSuccess: () => setEditingRole(null), onError },
                    )
                  }
                />
              ) : (
                <View
                  key={role.id}
                  className="min-h-11 flex-row items-center gap-2 border-b border-line"
                >
                  <View className="flex-1">
                    <Text className="text-sm text-ink">{role.name}</Text>
                    <Text className="font-mono text-xs text-ink-muted">
                      {t('team.grantsCount', { count: role.grants.length })}
                    </Text>
                  </View>
                  {isAdmin && online && (
                    <>
                      <Button
                        variant="ghost"
                        label={t('team.editRole')}
                        onPress={() => setEditingRole(role.id)}
                      />
                      <Button
                        variant="ghost"
                        label={t('team.deleteRole')}
                        onPress={() => setDeletingRole({ id: role.id, name: role.name })}
                      />
                    </>
                  )}
                </View>
              ),
            )}
            {editingRole === 'new' ? (
              <RoleEditor
                saving={roleMutations.save.isPending}
                onCancel={() => setEditingRole(null)}
                onSave={(next) =>
                  roleMutations.save.mutate(next, {
                    onSuccess: () => setEditingRole(null),
                    onError,
                  })
                }
              />
            ) : (
              isAdmin && (
                <Button
                  variant="ghost"
                  className="self-start"
                  label={t('team.newRole')}
                  disabled={!online}
                  onPress={() => setEditingRole('new')}
                />
              )
            )}
          </View>
        )}

        {isAdmin && (
          <View className="gap-4">
            <SectionLabel title={t('team.settings')} className="pt-0" />
            <ToggleRow
              title={t('team.approval')}
              hint={t('team.approvalHint')}
              value={data.join_approval}
              disabled={!online}
              onChange={(value) => m.update.mutate({ join_approval: value }, { onError })}
            />
            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="ghost"
                icon={Pencil}
                label={t('team.rename')}
                disabled={!online}
                onPress={() => setRenaming(true)}
              />
              {isOwner && (
                <Button
                  variant="ghost"
                  icon={Trash2}
                  label={t('team.delete')}
                  disabled={!online}
                  onPress={() => setDeleting(true)}
                />
              )}
            </View>
          </View>
        )}

        {isAdmin && (admin.data?.audit.length ?? 0) > 0 && (
          <View>
            <SectionLabel title={t('team.history')} className="pt-0" />
            {admin.data?.audit.map((entry) => (
              <View key={entry.id} className="gap-1 border-b border-line py-2">
                <Text className="text-sm text-ink">{describeAudit(entry, t)}</Text>
                <Text className="font-mono text-xs text-ink-muted">
                  {when.format(new Date(entry.created_at))}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {renaming && (
        <PromptDialog
          title={t('team.renameTitle')}
          fields={[
            {
              key: 'name',
              placeholder: t('team.namePlaceholder'),
              initial: data.name,
              maxLength: 60,
            },
            {
              key: 'icon',
              placeholder: t('team.emojiPlaceholder'),
              initial: data.icon ?? '',
              maxLength: 8,
            },
          ]}
          onClose={() => setRenaming(false)}
          onConfirm={({ name, icon }) => {
            setRenaming(false);
            m.update.mutate({ name, icon: icon || null }, { onError });
          }}
        />
      )}
      {creatingProject && (
        <PromptDialog
          title={t('team.newProject')}
          confirmLabel={t('team.create')}
          fields={[{ key: 'name', placeholder: t('folder.projectPlaceholder'), maxLength: 100 }]}
          onClose={() => setCreatingProject(false)}
          onConfirm={({ name }) => {
            setCreatingProject(false);
            m.createProject.mutate(name, {
              onSuccess: (folderId) =>
                router.push({ pathname: '/folder/[id]', params: { id: folderId } }),
              onError,
            });
          }}
        />
      )}
      {bringing && (
        <ActionMenu
          title={t('team.bringTitle')}
          actions={bringable.map((f) => ({
            label: f.name,
            onPress: () => m.setProjectTeam.mutate({ folderId: f.id, team: id }, { onError }),
          }))}
          onClose={() => setBringing(false)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={
            removing.userId === session?.user.id
              ? t('team.leaveTitle', { name: data.name })
              : t('team.removeTitle', { name: removing.displayName })
          }
          message={t('team.removeMessage')}
          confirmLabel={removing.userId === session?.user.id ? t('team.leave') : t('team.remove')}
          onClose={closeRemoving}
          onConfirm={() => {
            const member = removing;
            closeRemoving();
            m.removeMember.mutate(member.userId, {
              onSuccess: () => {
                if (member.userId === session?.user.id) router.replace('/teams');
              },
              onError,
            });
          }}
        />
      )}
      {deletingRole && (
        <ConfirmDialog
          title={t('team.deleteRoleTitle', { name: deletingRole.name })}
          message={t('team.deleteRoleMessage')}
          confirmLabel={t('team.deleteRole')}
          onClose={closeDeletingRole}
          onConfirm={() => {
            const { id: roleId } = deletingRole;
            closeDeletingRole();
            roleMutations.remove.mutate(roleId, { onError });
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('team.deleteTitle', { name: data.name })}
          message={t('team.deleteMessage')}
          confirmLabel={t('team.delete')}
          onClose={closeDeleting}
          onConfirm={() => {
            closeDeleting();
            m.remove.mutate(undefined, { onSuccess: () => router.replace('/teams'), onError });
          }}
        />
      )}
    </Screen>
  );
}
