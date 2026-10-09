import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import {
  useAcceptInvite,
  useInvitePreview,
  useMemberMutations,
  type InvitePreview,
} from '@/lib/queries/projects';
import { useSession } from '@/providers/session';

const ROLE_LABEL = { owner: 'dono', editor: 'editor', viewer: 'leitor' } as const;

/**
 * Link de convite (fora do login, ESCOPO 4.5): mostra o projeto, deixa criar a conta ali mesmo,
 * entra e pergunta "Você é o @gregory?" antes de abrir o projeto.
 */
export default function InviteScreen() {
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
    body = <Text className="text-center text-muted-foreground">Abrindo o convite…</Text>;
  } else if (preview.error || !preview.data?.valid) {
    body = (
      <>
        <Text className="text-center text-xl font-bold text-foreground">Convite inválido</Text>
        <Text className="text-center text-muted-foreground">
          {preview.data && !preview.data.valid
            ? preview.data.reason
            : 'Não deu para abrir o convite.'}{' '}
          Peça um link novo para quem te convidou.
        </Text>
        <Button variant="outline" label="Ir para o Questlist" onPress={() => router.replace('/')} />
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
            <Text className="text-center text-sm text-muted-foreground">
              Crie sua conta (ou entre) para participar.
            </Text>
            <SignInForm initialMode="sign-up" />
          </>
        ) : invite.already_member ? (
          <Button label="Abrir o projeto" onPress={() => openFolder(invite.folder_id)} />
        ) : (
          <>
            {accept.error && (
              <Text className="text-center text-destructive">{accept.error.message}</Text>
            )}
            <Button label="Participar" loading={accept.isPending} onPress={join} />
          </>
        )}
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow items-center justify-center px-6 py-10"
        >
          <View className="w-full max-w-sm gap-4">{body}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InviteCard({ invite }: { invite: Extract<InvitePreview, { valid: true }> }) {
  return (
    <View className="items-center gap-1 rounded-2xl border border-border bg-card p-5">
      <Text style={{ fontSize: 40, lineHeight: 48 }}>{invite.folder_icon || '📁'}</Text>
      <Text accessibilityRole="header" className="text-center text-2xl font-bold text-foreground">
        {invite.folder_name}
      </Text>
      <Text className="text-center text-muted-foreground">
        {invite.inviter ? `${invite.inviter} te convidou` : 'Você foi convidado'} para participar
        como {ROLE_LABEL[invite.role]}.
      </Text>
      <Text className="text-xs text-muted-foreground">
        {invite.members === 1 ? '1 pessoa' : `${invite.members} pessoas`} no projeto
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
  const { claim } = useMemberMutations(folderId);
  return (
    <>
      <Text accessibilityRole="header" className="text-center text-2xl font-bold text-foreground">
        Você entrou! Quem é você na lista?
      </Text>
      <Text className="text-center text-muted-foreground">
        Algumas tarefas foram atribuídas antes de você chegar. Escolha o seu nome e elas passam a
        ser suas.
      </Text>
      {claim.error && <Text className="text-center text-destructive">{claim.error.message}</Text>}
      {names.map((name) => (
        <Button
          key={name}
          variant="outline"
          label={`Sou @${name}`}
          disabled={claim.isPending}
          onPress={() => claim.mutate({ name }, { onSuccess: () => onDone(folderId) })}
        />
      ))}
      <Button variant="ghost" label="Nenhum desses" onPress={() => onDone(folderId)} />
    </>
  );
}
