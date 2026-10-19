import * as Clipboard from 'expo-clipboard';
import { Copy, Link2, LogOut, Shield } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BossBoard } from '@/components/boss-board';
import { BossLine } from '@/components/game-bar';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { PersonRow } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { describeClanActivity } from '@/lib/activity';
import { clanInviteUrl, useClan, useClanMutations } from '@/lib/queries/clan';
import { useGameState } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

// Clã: grupo de amigos sem projeto em comum. Boss semanal cooperativo e feed, sem chat.
export default function ClanScreen() {
  const { t, i18n } = useTranslation();
  const when = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const onError = (err: Error) => toast({ message: t('clan.error', { message: err.message }) });

  if (clan.isPending) return <Screen>{null}</Screen>;

  if (!clan.data) {
    return (
      <Screen>
        <ScreenHeader title={t('clan.title')} back />
        <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-12">
          <Text className="text-sm text-ink-muted">{t('clan.intro')}</Text>
          <Input
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder={t('clan.namePlaceholder')}
            accessibilityLabel={t('clan.name')}
          />
          <Input
            value={icon}
            onChangeText={setIcon}
            maxLength={8}
            placeholder={t('clan.emojiPlaceholder')}
            accessibilityLabel={t('clan.emoji')}
          />
          <Button
            className="self-start"
            label={t('clan.create')}
            disabled={!name.trim() || !online}
            loading={m.create.isPending}
            onPress={() => m.create.mutate({ name: name.trim(), icon: icon.trim() }, { onError })}
          />
          <Text className="text-sm text-ink-muted">{t('clan.gotInvite')}</Text>
        </ScreenScroll>
      </Screen>
    );
  }

  const data = clan.data;
  const boss = game.data?.clan_boss;

  return (
    <Screen size="medium">
      <ScreenHeader
        title={data.name}
        icon={
          data.icon ? (
            <Text className="text-lg">{data.icon}</Text>
          ) : (
            <Icon icon={Shield} size={20} tone="ink-muted" />
          )
        }
        back
      />
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-8 pb-12">
        {boss && game.data?.enabled !== false && (
          <View className="gap-3">
            <SectionLabel title={t('clan.weeklyBoss')} className="pt-0" />
            <BossLine boss={boss} />
            <BossBoard bossId={boss.id} />
          </View>
        )}

        <View>
          <SectionLabel title={t('clan.members')} count={data.members.length} className="pt-0" />
          {data.members.map((member) => (
            <PersonRow
              key={member.userId}
              name={`${member.displayName}${member.userId === session?.user.id ? ` ${t('clan.you')}` : ''}`}
              detail={member.role === 'owner' ? t('clan.founder') : undefined}
              right={
                <Text className="font-mono text-xs text-ink-muted">
                  {t('clan.level', { level: member.level })}
                </Text>
              }
            />
          ))}
        </View>

        <View className="gap-3">
          <SectionLabel title={t('clan.invite')} className="pt-0" />
          {link ? (
            <>
              <Text
                selectable
                accessibilityLabel={t('clan.inviteLink')}
                className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
              >
                {link}
              </Text>
              <Button
                className="self-start"
                icon={Copy}
                label={t('clan.copy')}
                onPress={async () => {
                  await Clipboard.setStringAsync(link);
                  toast({ message: t('clan.copied') });
                }}
              />
            </>
          ) : (
            <Button
              variant="ghost"
              className="self-start"
              icon={Link2}
              label={t('clan.generate')}
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

        <View>
          <SectionLabel title={t('clan.feed')} className="pt-0" />
          {data.activity.length === 0 && (
            <Text className="py-3 text-sm text-ink-muted">{t('clan.nothing')}</Text>
          )}
          {data.activity.map((a) => (
            <View
              key={a.id}
              className="min-h-10 flex-row items-center gap-3 border-b border-line py-1"
            >
              <Text className="flex-1 text-sm text-ink">{describeClanActivity(a)}</Text>
              <Text className="font-mono text-xs text-ink-muted">
                {when.format(new Date(a.created_at))}
              </Text>
            </View>
          ))}
        </View>

        <Button
          variant="ghost"
          className="self-start"
          icon={LogOut}
          label={t('clan.leave')}
          disabled={!online}
          onPress={() => setConfirmLeave(true)}
        />
      </ScreenScroll>

      {confirmLeave && (
        <ConfirmDialog
          title={t('clan.leaveTitle', { name: data.name })}
          message={t('clan.leaveMessage')}
          confirmLabel={t('clan.leaveConfirm')}
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
