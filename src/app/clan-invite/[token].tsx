import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useClanInvitePreview, useClanMutations } from '@/lib/queries/clan';
import { useSession } from '@/providers/session';

// Convite do clã: abre com ou sem login (cria a conta ali mesmo), como o convite de projeto.
export default function ClanInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const preview = useClanInvitePreview(token, !!session);
  const { join } = useClanMutations();

  let body;
  if (preview.isPending) {
    body = <Text className="text-center text-ink-muted">Abrindo o convite…</Text>;
  } else if (preview.error || !preview.data?.valid) {
    body = (
      <>
        <Text className="text-center text-lg font-semibold text-ink">Convite inválido</Text>
        <Text className="text-center text-ink-muted">
          {preview.data && !preview.data.valid
            ? preview.data.reason
            : 'Não deu para abrir o convite.'}
        </Text>
        <Button variant="ghost" label="Ir para o Questlist" onPress={() => router.replace('/')} />
      </>
    );
  } else {
    const clan = preview.data;
    const member = clan.my_clan === clan.clan_id;
    body = (
      <>
        <View className="items-center gap-1 rounded-lg border border-line bg-surface p-6">
          <Text style={{ fontSize: 40, lineHeight: 48 }}>{clan.icon || '🛡️'}</Text>
          <Text accessibilityRole="header" className="text-center text-xl font-semibold text-ink">
            {clan.name}
          </Text>
          <Text className="text-center text-ink-muted">
            {clan.inviter ? `${clan.inviter} te chamou` : 'Você foi chamado'} para o clã.{' '}
            {clan.members === 1 ? '1 pessoa' : `${clan.members} pessoas`} enfrentando o boss da
            semana juntas.
          </Text>
        </View>
        {!session ? (
          <SignInForm initialMode="sign-up" />
        ) : member ? (
          <Button label="Abrir o clã" onPress={() => router.replace('/clan')} />
        ) : clan.my_clan ? (
          <Text className="text-center text-ink-muted">
            Você já está em outro clã. Saia dele (Perfil → Clã) para entrar neste.
          </Text>
        ) : (
          <>
            {join.error && <Text className="text-center text-danger">{join.error.message}</Text>}
            <Button
              label="Entrar no clã"
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
