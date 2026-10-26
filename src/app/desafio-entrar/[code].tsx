import { router, useLocalSearchParams } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatShortDate } from '@/lib/parser/dates';
import { useChallengeMutations, useChallengePreview } from '@/lib/queries/challenges';
import { useSession } from '@/providers/session';

// Link do código do desafio (AC15C): abre com ou sem login (cria a conta ali mesmo), como o
// convite do time e o do clã, e quem tem o código entra direto.
export default function ChallengeJoinScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useSession();
  const preview = useChallengePreview(code, !!session);
  const { join } = useChallengeMutations();
  const open = (id: string) => router.replace({ pathname: '/desafio/[id]', params: { id } });

  let body;
  const p = preview.data;
  if (preview.isPending) {
    body = (
      <Text className="text-center text-sm text-ink-muted">{t('challenge.join.opening')}</Text>
    );
  } else if (preview.error || !p?.valid) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('challenge.join.invalid')}</Text>
        <Text className="text-sm text-ink-muted">{t('challenge.join.invalidHint')}</Text>
        <Button
          variant="ghost"
          label={t('challenge.join.home')}
          onPress={() => router.replace('/')}
        />
      </>
    );
  } else {
    body = (
      <>
        <View className="gap-2 border-b border-line pb-6">
          <Icon icon={Trophy} size={20} tone="ink-muted" />
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {p.name}
          </Text>
          <Text className="text-sm text-ink-muted">
            {p.creator
              ? t('challenge.join.calledBy', { name: p.creator })
              : t('challenge.join.called')}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            {t('challenge.join.info', {
              days: p.days,
              start: formatShortDate(p.starts_on),
              end: formatShortDate(p.ends_on),
              members: t('challenge.members', { count: p.members }),
              scoring: t(`challenge.scoring.${p.scoring}`),
            })}
          </Text>
          <Text className="text-xs text-ink-muted">{t(`challenge.rule.${p.scoring}`)}</Text>
        </View>
        {!session ? (
          <SignInForm initialMode="sign-up" />
        ) : p.member ? (
          <Button label={t('challenge.join.open')} onPress={() => open(p.id)} />
        ) : p.over ? (
          <Text className="text-sm text-ink-muted">{t('challenge.join.over')}</Text>
        ) : (
          <>
            {join.error && <Text className="text-sm text-danger">{join.error.message}</Text>}
            <Button
              label={t('challenge.join.submit')}
              loading={join.isPending}
              onPress={() => join.mutateAsync(code).then(open, () => {})}
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
