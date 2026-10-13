import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { BossBoard } from '@/components/boss-board';
import { BossLine } from '@/components/game-bar';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { describeClanActivity } from '@/lib/activity';
import { initials } from '@/lib/members';
import { clanInviteUrl, useClan, useClanMutations } from '@/lib/queries/clan';
import { useGameState } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const WHEN = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Clã (ESCOPO 4.6): grupo de amigos sem projeto em comum. Boss semanal cooperativo e feed, sem chat.
export default function ClanScreen() {
  const clan = useClan();
  const game = useGameState();
  const { session } = useSession();
  const online = useIsOnline();
  const toast = useToast();
  const m = useClanMutations();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave, closeLeave] = useDialog<true>();
  const onError = (err: Error) => toast({ message: `Não deu certo: ${err.message}` });

  if (clan.isPending) return <Screen>{null}</Screen>;

  if (!clan.data) {
    return (
      <Screen>
        <ScreenHeader title="🛡️ Clã" back />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-12">
          <Text className="text-ink-muted">
            Junte os amigos num clã: toda semana aparece um boss do grupo, e cada XP que alguém
            ganha é um golpe nele. Quem ajudou ganha a recompensa. Sem ranking de quem ficou para
            trás.
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder="Nome do clã (ex.: Os Produtivos)"
            accessibilityLabel="Nome do clã"
          />
          <Input
            value={icon}
            onChangeText={setIcon}
            maxLength={8}
            placeholder="Emoji (opcional, ex.: 🛡️)"
            accessibilityLabel="Emoji do clã"
          />
          <Button
            label="Criar clã"
            disabled={!name.trim() || !online}
            loading={m.create.isPending}
            onPress={() => m.create.mutate({ name: name.trim(), icon: icon.trim() }, { onError })}
          />
          <Text className="text-sm text-ink-muted">
            Recebeu um convite? Abra o link que te mandaram.
          </Text>
        </ScrollView>
      </Screen>
    );
  }

  const data = clan.data;
  const boss = game.data?.clan_boss;

  return (
    <Screen size="medium">
      <ScreenHeader title={`${data.icon || '🛡️'} ${data.name}`} back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 pb-12">
        {boss && game.data?.enabled !== false && (
          <View className="gap-2 rounded-xl border border-line bg-surface p-3">
            <Text className="font-semibold text-ink">Boss da semana do clã</Text>
            <BossLine boss={boss} />
            <BossBoard bossId={boss.id} />
          </View>
        )}

        <View className="gap-2">
          <Text className="font-semibold text-ink">Membros ({data.members.length})</Text>
          {data.members.map((member) => (
            <View key={member.userId} className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-accent">
                <Text className="text-xs font-bold text-on-accent">
                  {initials(member.displayName)}
                </Text>
              </View>
              <Text className="flex-1 text-base text-ink">
                {member.displayName}
                {member.userId === session?.user.id ? ' (você)' : ''}
              </Text>
              <Text className="text-sm text-ink-muted">
                Nv {member.level}
                {member.role === 'owner' ? ' · criou o clã' : ''}
              </Text>
            </View>
          ))}
        </View>

        <View className="gap-2">
          <Text className="font-semibold text-ink">Convidar</Text>
          {link ? (
            <>
              <Text
                selectable
                accessibilityLabel="Link de convite do clã"
                className="rounded-lg border border-line bg-surface p-3 text-sm text-ink"
              >
                {link}
              </Text>
              <Button
                className="self-start"
                label="Copiar link"
                onPress={async () => {
                  await Clipboard.setStringAsync(link);
                  toast({ message: 'Link copiado' });
                }}
              />
            </>
          ) : (
            <Button
              variant="outline"
              className="self-start"
              label="Gerar link de convite"
              disabled={!online}
              loading={m.invite.isPending}
              onPress={() =>
                m.invite.mutate(undefined, {
                  onSuccess: (token) => setLink(clanInviteUrl(token)),
                  onError,
                })
              }
            />
          )}
        </View>

        <View className="gap-1">
          <Text className="font-semibold text-ink">Feed</Text>
          {data.activity.length === 0 && (
            <Text className="text-sm text-ink-muted">Nada ainda.</Text>
          )}
          {data.activity.map((a) => (
            <View key={a.id} className="flex-row gap-2 py-1">
              <Text className="flex-1 text-sm text-ink">{describeClanActivity(a)}</Text>
              <Text className="text-xs text-ink-muted">
                {WHEN.format(new Date(a.created_at))}
              </Text>
            </View>
          ))}
        </View>

        <Button
          variant="ghost"
          className="self-start"
          label="Sair do clã"
          disabled={!online}
          onPress={() => setConfirmLeave(true)}
        />
      </ScrollView>

      {confirmLeave && (
        <ConfirmDialog
          title={`Sair de "${data.name}"?`}
          message="Seu XP e suas conquistas continuam com você. Dá para entrar de novo com um convite."
          confirmLabel="Sair"
          onClose={closeLeave}
          onConfirm={() => {
            closeLeave();
            m.leave.mutate(undefined, { onError });
          }}
        />
      )}
    </Screen>
  );
}
