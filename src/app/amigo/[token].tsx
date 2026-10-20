import { router, useLocalSearchParams } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcceptFriendLink, useFriendLinkPreview } from '@/lib/queries/friends';
import { useSession } from '@/providers/session';

// Link de amizade (D230): abre com ou sem login (cria a conta ali mesmo), como os convites.
export default function FriendLinkScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const preview = useFriendLinkPreview(token);
  const accept = useAcceptFriendLink();
  const mine = accept.data && accept.data === session?.user.id;

  let body;
  if (preview.isPending) {
    body = <Text className="text-center text-sm text-ink-muted">{t('invite.opening')}</Text>;
  } else if (preview.error || !preview.data) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('friends.linkInvalid')}</Text>
        <Text className="text-sm text-ink-muted">{t('friends.linkInvalidHint')}</Text>
        <Button variant="ghost" label={t('invite.goHome')} onPress={() => router.replace('/')} />
      </>
    );
  } else {
    const who = preview.data;
    body = (
      <>
        <View className="gap-2 border-b border-line pb-6">
          <Icon icon={UserPlus} size={20} tone="ink-muted" />
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {t('friends.linkTitle', { name: who.display_name })}
          </Text>
          <Text className="font-mono text-sm text-ink-muted">@{who.username}</Text>
        </View>
        {!session ? (
          <SignInForm initialMode="sign-up" />
        ) : accept.isSuccess ? (
          <>
            <Text className="text-sm text-ink" role="status">
              {mine ? t('friends.linkOwn') : t('friends.linkDone', { name: who.display_name })}
            </Text>
            <Button label={t('friends.open')} onPress={() => router.replace('/amigos')} />
          </>
        ) : (
          <>
            {accept.error && <Text className="text-sm text-danger">{accept.error.message}</Text>}
            <Button
              label={t('friends.linkAccept')}
              loading={accept.isPending}
              onPress={() => accept.mutate(token)}
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
