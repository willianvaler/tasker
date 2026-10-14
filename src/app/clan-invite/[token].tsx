import { router, useLocalSearchParams } from 'expo-router';
import { Shield } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useClanInvitePreview, useClanMutations } from '@/lib/queries/clan';
import { useSession } from '@/providers/session';

// Convite do clã: abre com ou sem login (cria a conta ali mesmo), como o convite de projeto.
export default function ClanInviteScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const preview = useClanInvitePreview(token, !!session);
  const { join } = useClanMutations();

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
    const clan = preview.data;
    const member = clan.my_clan === clan.clan_id;
    body = (
      <>
        <View className="gap-2 border-b border-line pb-6">
          {clan.icon ? (
            <Text className="text-lg">{clan.icon}</Text>
          ) : (
            <Icon icon={Shield} size={20} tone="ink-muted" />
          )}
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {clan.name}
          </Text>
          <Text className="text-sm text-ink-muted">
            {clan.inviter
              ? t('invite.clanCalledBy', { name: clan.inviter })
              : t('invite.clanCalled')}{' '}
            {t('invite.clanMembers', { count: clan.members })}
          </Text>
        </View>
        {!session ? (
          <SignInForm initialMode="sign-up" />
        ) : member ? (
          <Button label={t('invite.openClan')} onPress={() => router.replace('/clan')} />
        ) : clan.my_clan ? (
          <Text className="text-sm text-ink-muted">{t('invite.otherClan')}</Text>
        ) : (
          <>
            {join.error && <Text className="text-sm text-danger">{join.error.message}</Text>}
            <Button
              label={t('invite.joinClan')}
              loading={join.isPending}
              onPress={() => join.mutate(token, { onSuccess: () => router.replace('/clan') })}
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
