import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAcceptShare, useSharePreview } from '@/lib/queries/shares';
import { useSession } from '@/providers/session';

/**
 * Link de página enviada (L3, D135), fora do login: mostra a página e quem enviou, deixa criar a
 * conta ali mesmo e, ao receber, abre direto a página (sem passar pela introdução).
 */
export default function SentPageScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const preview = useSharePreview(token, !!session);
  const accept = useAcceptShare().byLink;

  const open = (pageId: string) =>
    router.replace({ pathname: '/page/[id]', params: { id: pageId } });

  let body;
  if (preview.isPending) {
    body = <Text className="text-center text-sm text-ink-muted">{t('invite.opening')}</Text>;
  } else if (preview.error || !preview.data?.valid) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('send.invalid')}</Text>
        <Text className="text-sm text-ink-muted">
          {preview.data && !preview.data.valid ? preview.data.reason : t('invite.openError')}{' '}
          {t('send.askNew')}
        </Text>
        <Button variant="ghost" label={t('invite.goHome')} onPress={() => router.replace('/')} />
      </>
    );
  } else {
    const page = preview.data;
    body = (
      <>
        <View className="gap-2 border-b border-line pb-6">
          <ItemIcon icon={page.page_icon} kind={page.view_type as ItemKind} size={20} />
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {page.page_name}
          </Text>
          <Text className="text-sm text-ink-muted">
            {page.owner_name
              ? t(page.mode === 'live' ? 'send.sentByLive' : 'send.sentByCopy', {
                  name: page.owner_name,
                })
              : t(page.mode === 'live' ? 'send.modeLiveHint' : 'send.modeCopyHint')}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            {t('send.items', { count: page.items })}
          </Text>
        </View>
        {!session ? (
          <>
            <Text className="text-sm text-ink-muted">{t('send.createToReceive')}</Text>
            <SignInForm initialMode="sign-up" />
          </>
        ) : page.own ? (
          <Text className="text-sm text-ink-muted">{t('send.ownLink')}</Text>
        ) : page.opened_page_id ? (
          <Button label={t('send.openPage')} onPress={() => open(page.opened_page_id ?? '')} />
        ) : (
          <>
            {accept.error && <Text className="text-sm text-danger">{accept.error.message}</Text>}
            <Button
              label={t('send.receive')}
              loading={accept.isPending}
              onPress={() =>
                accept.mutate(
                  { token, folderName: t('send.folderName') },
                  { onSuccess: (result) => open(result.page_id) },
                )
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
