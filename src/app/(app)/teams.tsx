import { Link, router } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import {
  TEAM_ROLE_LABEL,
  useAcceptTeamInvite,
  useMyTeamInvites,
  useTeamMutations,
  useTeams,
} from '@/lib/queries/teams';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

export default function TeamsScreen() {
  const { t } = useTranslation();
  const teams = useTeams();
  const invites = useMyTeamInvites();
  const accept = useAcceptTeamInvite();
  const m = useTeamMutations();
  const online = useIsOnline();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const onError = (err: Error) => toast({ message: t('team.error', { message: err.message }) });
  const pending = (invites.data ?? []).filter(
    (i) => !teams.data?.some((team) => team.id === i.team_id),
  );

  return (
    <Screen size="medium">
      <ScreenHeader
        title={t('team.title')}
        back
        right={
          <Button
            icon={Plus}
            label={t('team.new')}
            disabled={!online}
            onPress={() => setCreating(true)}
          />
        }
      />
      <ScrollView contentContainerClassName="gap-6 pb-12">
        <Text className="text-sm text-ink-muted">{t('team.hint')}</Text>

        {pending.length > 0 && (
          <View>
            <SectionLabel title={t('team.forYou')} count={pending.length} className="pt-0" />
            {pending.map((invite) => (
              <View
                key={invite.id}
                className="flex-row items-center gap-3 border-b border-line py-3"
              >
                <Text className="flex-1 text-sm text-ink">{t(TEAM_ROLE_LABEL[invite.role])}</Text>
                <Button
                  label={t('team.accept')}
                  loading={accept.isPending}
                  disabled={!online}
                  onPress={() =>
                    accept.mutate(invite.token, {
                      onSuccess: ({ team_id }) =>
                        router.push({ pathname: '/team/[id]', params: { id: team_id } }),
                      onError,
                    })
                  }
                />
              </View>
            ))}
          </View>
        )}

        <View>
          <SectionLabel title={t('team.title')} count={teams.data?.length} className="pt-0" />
          {teams.data?.length === 0 && <EmptyState title={t('team.empty')} />}
          {teams.data?.map((team) => (
            <Link key={team.id} href={{ pathname: '/team/[id]', params: { id: team.id } }} asChild>
              <Pressable
                accessibilityRole="link"
                className="min-h-12 flex-row items-center gap-3 border-b border-line py-3 web:hover:bg-wash"
              >
                {team.icon ? (
                  <Text className="text-lg">{team.icon}</Text>
                ) : (
                  <Icon icon={Users} size={20} tone="ink-muted" />
                )}
                <View className="flex-1">
                  <Text className="text-sm text-ink">{team.name}</Text>
                  <Text className="font-mono text-xs text-ink-muted">
                    {t(TEAM_ROLE_LABEL[team.myRole])} ·{' '}
                    {t('team.members', { count: team.memberCount })}
                  </Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>

      {creating && (
        <PromptDialog
          title={t('team.new')}
          confirmLabel={t('team.create')}
          fields={[
            { key: 'name', placeholder: t('team.namePlaceholder'), maxLength: 60 },
            { key: 'icon', placeholder: t('team.emojiPlaceholder'), maxLength: 8 },
          ]}
          onClose={() => setCreating(false)}
          onConfirm={({ name, icon }) => {
            setCreating(false);
            m.create.mutate(
              { name, icon },
              {
                onSuccess: (id) => router.push({ pathname: '/team/[id]', params: { id } }),
                onError,
              },
            );
          }}
        />
      )}
    </Screen>
  );
}
