import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemIcon } from '@/components/item-icon';
import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import {
  useAcceptInvite,
  useInvitePreview,
  useMemberMutations,
  type InvitePreview,
} from '@/lib/queries/projects';
import { Text } from '@/components/ui/text';
import { useSession } from '@/providers/session';

const ROLE_LABEL = {
  owner: 'invite.roleOwner',
  editor: 'invite.roleEditor',
  viewer: 'invite.roleViewer',
} as const;

/**
 * Link de convite (fora do login, ESCOPO 4.5): mostra o projeto, deixa criar a conta ali mesmo,
 * entra e pergunta "Você é o @gregory?" antes de abrir o projeto.
 */
export default function InviteScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const preview = useInvitePreview(token, !!session);
  const accept = useAcceptInvite();
  const [joined, setJoined] = useState<{ folderId: string; pending: string[] } | null>(null);

  const openFolder = (folderId: string) =>
    router.replace({ pathname: '/folder/[id]', params: { id: folderId } });

  function join() {
    accept.mutate(token, {
      onSuccess: (result) => {
        if (result.pending.length)
          setJoined({ folderId: result.folder_id, pending: result.pending });
        else openFolder(result.folder_id);
      },
    });
  }

  let body;
  if (preview.isPending) {
    body = <Text className="text-center text-sm text-ink-muted">{t('invite.opening')}</Text>;
  } else if (preview.error || !preview.data?.valid) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('invite.invalid')}</Text>
        <Text className="text-sm text-ink-muted">
          {preview.data && !preview.data.valid ? preview.data.reason : t('invite.openError')}{' '}
          {t('invite.askNew')}
        </Text>
        <Button variant="ghost" label={t('invite.goHome')} onPress={() => router.replace('/')} />
      </>
    );
  } else if (joined) {
    body = <ClaimPending folderId={joined.folderId} names={joined.pending} onDone={openFolder} />;
  } else {
    const invite = preview.data;
    body = (
      <>
        <InviteCard invite={invite} />
        {!session ? (
          <>
            <Text className="text-sm text-ink-muted">{t('invite.createToJoin')}</Text>
            <SignInForm initialMode="sign-up" />
          </>
        ) : invite.already_member ? (
          <Button label={t('invite.openProject')} onPress={() => openFolder(invite.folder_id)} />
        ) : (
          <>
            {accept.error && <Text className="text-sm text-danger">{accept.error.message}</Text>}
            <Button label={t('invite.join')} loading={accept.isPending} onPress={join} />
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

function InviteCard({ invite }: { invite: Extract<InvitePreview, { valid: true }> }) {
  const { t } = useTranslation();
  const role = t(ROLE_LABEL[invite.role]);
  return (
    <View className="gap-2 border-b border-line pb-6">
      <ItemIcon icon={invite.folder_icon} kind="project" size={20} />
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {invite.folder_name}
      </Text>
      <Text className="text-sm text-ink-muted">
        {invite.inviter
          ? t('invite.invitedBy', { name: invite.inviter, role })
          : t('invite.invited', { role })}
      </Text>
      <Text className="font-mono text-xs text-ink-muted">
        {t('invite.members', { count: invite.members })}
      </Text>
    </View>
  );
}

/** "Você é o @gregory?" — as tarefas do nome escolhido passam a ser suas. */
function ClaimPending({
  folderId,
  names,
  onDone,
}: {
  folderId: string;
  names: string[];
  onDone: (folderId: string) => void;
}) {
  const { t } = useTranslation();
  const { claim } = useMemberMutations(folderId);
  return (
    <>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {t('invite.claimTitle')}
      </Text>
      <Text className="text-sm text-ink-muted">{t('invite.claimHint')}</Text>
      {claim.error && <Text className="text-sm text-danger">{claim.error.message}</Text>}
      {names.map((name) => (
        <Button
          key={name}
          variant="ghost"
          label={t('invite.iAm', { name })}
          disabled={claim.isPending}
          onPress={() => claim.mutate({ name }, { onSuccess: () => onDone(folderId) })}
        />
      ))}
      <Button variant="ghost" label={t('invite.none')} onPress={() => onDone(folderId)} />
    </>
  );
}
