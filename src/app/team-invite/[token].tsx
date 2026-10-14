import { router, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TEAM_ROLE_LABEL, useAcceptTeamInvite, useTeamInvitePreview } from '@/lib/queries/teams';
import { useSession } from '@/providers/session';

// Convite do time: abre com ou sem login (cria a conta ali mesmo), como o de projeto e o do clã.
export default function TeamInviteScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const preview = useTeamInvitePreview(token, !!session);
  const accept = useAcceptTeamInvite();
  const openTeam = (id: string) => router.replace({ pathname: '/team/[id]', params: { id } });

  let body;
  if (preview.isPending) {
    body = <Text className="text-center text-sm text-ink-muted">{t('invite.opening')}</Text>;
  } else if (preview.error || !preview.data?.valid) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('invite.invalid')}</Text>
        <Text className="text-sm text-ink-muted">
          {preview.data && !preview.data.valid ? preview.data.reason : t('invite.openError')}
        </Text>
        <Button variant="ghost" label={t('invite.goHome')} onPress={() => router.replace('/')} />
      </>
    );
  } else {
    const team = preview.data;
    const requested = team.requested || accept.data?.status === 'requested';
    body = (
      <>
        <View className="gap-2 border-b border-line pb-6">
          {team.team_icon ? (
            <Text className="text-lg">{team.team_icon}</Text>
          ) : (
            <Icon icon={Users} size={20} tone="ink-muted" />
          )}
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {team.team_name}
          </Text>
          <Text className="text-sm text-ink-muted">
            {team.inviter
              ? t('invite.teamCalledBy', { name: team.inviter })
              : t('invite.teamCalled')}{' '}
            {t('invite.teamRole', { role: t(TEAM_ROLE_LABEL[team.role]) })}{' '}
            {t('invite.teamMembers', { count: team.members })}
          </Text>
          {team.needs_approval && !team.already_member && (
            <Text className="text-sm text-ink-muted">{t('invite.needsApproval')}</Text>
          )}
        </View>
        {!session ? (
          <SignInForm initialMode="sign-up" />
        ) : team.already_member ? (
          <Button label={t('invite.openTeam')} onPress={() => openTeam(team.team_id)} />
        ) : !team.email_matches ? (
          <Text className="text-sm text-danger">{t('invite.otherEmail')}</Text>
        ) : requested ? (
          <Text className="text-sm text-ink-muted">{t('invite.requested')}</Text>
        ) : (
          <>
            {accept.error && <Text className="text-sm text-danger">{accept.error.message}</Text>}
            <Button
              label={team.needs_approval ? t('invite.askToJoin') : t('invite.joinTeam')}
              loading={accept.isPending}
              onPress={() =>
                accept.mutate(token, {
                  onSuccess: (result) => {
                    if (result.status !== 'requested') openTeam(result.team_id);
                  },
                })
              }
            />
          </>
        )}
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow items-center justify-center px-6 py-12"
        >
          <View className="w-full max-w-sm gap-4">{body}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
