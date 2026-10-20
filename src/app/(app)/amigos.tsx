import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, RefreshCw, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PersonRow } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { friendQuery } from '@/lib/friends';
import {
  useFriendActions,
  useFriendLink,
  useMyFriends,
  useSetUsername,
  type Friend,
} from '@/lib/queries/friends';
import { useProfile } from '@/lib/queries/profile';
import { inviteUrl } from '@/lib/queries/projects';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/** Amigos (ESCOPO_V10 §1, D230): meu nick, adicionar por nick ou e-mail, meu link, pedidos e amigos. */
export default function FriendsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const friends = useMyFriends();
  const actions = useFriendActions();
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<Friend | null>(null);
  const onError = (err: Error) => toast({ message: err.message });

  const all = friends.data ?? [];
  const incoming = all.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = all.filter((f) => f.status === 'pending' && !f.incoming);
  const accepted = all.filter((f) => f.status === 'accepted');

  function add() {
    const parsed = friendQuery(query);
    if (!parsed) {
      toast({ message: t('friends.badQuery') });
      return;
    }
    actions.request.mutate(parsed, {
      onSuccess: (result) => {
        const key =
          'email' in parsed && result === 'sent'
            ? 'friends.sentEmail'
            : (
                {
                  sent: 'friends.sent',
                  accepted: 'friends.acceptedNow',
                  already: 'friends.already',
                  self: 'friends.self',
                  not_found: 'friends.notFound',
                } as const
              )[result];
        toast({ message: t(key, { query: query.trim() }) });
        if (result === 'sent' || result === 'accepted') setQuery('');
      },
      onError,
    });
  }

  return (
    <Screen size="medium">
      <ScreenHeader title={t('friends.title')} help="time" back />
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-8 pb-12">
        <NickCard />

        <View className="gap-3">
          <SectionLabel title={t('friends.add')} className="pt-0" />
          <View className="flex-row gap-2">
            <Input
              className="flex-1"
              value={query}
              onChangeText={setQuery}
              placeholder={t('friends.addPlaceholder')}
              accessibilityLabel={t('friends.addLabel')}
              autoCapitalize="none"
              autoCorrect={false}
              submitBehavior="submit"
              onSubmitEditing={add}
              editable={online}
            />
            <Button
              label={t('friends.request')}
              onPress={add}
              loading={actions.request.isPending}
              disabled={!online || !query.trim()}
            />
          </View>
        </View>

        <LinkCard />

        {incoming.length > 0 && (
          <View className="gap-1">
            <SectionLabel title={t('friends.incoming')} count={incoming.length} />
            {incoming.map((f) => (
              <PersonRow
                key={f.user_id}
                name={f.display_name}
                detail={`@${f.username}`}
                right={
                  <View className="flex-row gap-1">
                    <Button
                      label={t('friends.accept')}
                      accessibilityLabel={t('friends.acceptLabel', { name: f.display_name })}
                      onPress={() =>
                        actions.respond.mutate({ userId: f.user_id, accept: true }, { onError })
                      }
                    />
                    <Button
                      variant="ghost"
                      label={t('friends.decline')}
                      accessibilityLabel={t('friends.declineLabel', { name: f.display_name })}
                      onPress={() =>
                        actions.respond.mutate({ userId: f.user_id, accept: false }, { onError })
                      }
                    />
                  </View>
                }
              />
            ))}
          </View>
        )}

        <View className="gap-1">
          <SectionLabel title={t('friends.list')} count={accepted.length} />
          {!friends.isPending && accepted.length === 0 && (
            <EmptyState title={t('friends.empty')} hint={t('friends.emptyHint')} />
          )}
          {accepted.map((f) => (
            <PersonRow
              key={f.user_id}
              name={f.display_name}
              detail={`@${f.username}`}
              right={
                <View className="flex-row gap-1">
                  <Button
                    variant="ghost"
                    label={t('friends.profile')}
                    accessibilityLabel={t('friends.profileLabel', { name: f.display_name })}
                    onPress={() =>
                      router.push({ pathname: '/pessoa', params: { nick: f.username } })
                    }
                  />
                  <Button
                    destructive
                    variant="ghost"
                    label={t('friends.remove')}
                    accessibilityLabel={t('friends.removeLabel', { name: f.display_name })}
                    onPress={() => setRemoving(f)}
                  />
                </View>
              }
            />
          ))}
        </View>

        {outgoing.length > 0 && (
          <View className="gap-1">
            <SectionLabel title={t('friends.outgoing')} count={outgoing.length} />
            {outgoing.map((f) => (
              <PersonRow
                key={f.user_id}
                name={f.display_name}
                detail={`@${f.username}`}
                right={
                  <Button
                    variant="ghost"
                    label={t('friends.cancel')}
                    accessibilityLabel={t('friends.cancelLabel', { name: f.display_name })}
                    onPress={() => actions.remove.mutate(f.user_id, { onError })}
                  />
                }
              />
            ))}
          </View>
        )}
      </ScreenScroll>
      {removing && (
        <ConfirmDialog
          title={t('friends.removeTitle', { name: removing.display_name })}
          message={t('friends.removeMessage')}
          confirmLabel={t('friends.remove')}
          destructive
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            actions.remove.mutate(removing.user_id, { onError });
            setRemoving(null);
          }}
        />
      )}
    </Screen>
  );
}

function NickCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const profile = useProfile();
  const setUsername = useSetUsername();
  const current = profile.data?.username ?? '';
  const [nick, setNick] = useState<string | null>(null);
  const value = nick ?? current;
  return (
    <View className="gap-2">
      <SectionLabel title={t('friends.nick')} className="pt-0" />
      <Text className="text-sm text-ink-muted">{t('friends.nickHint')}</Text>
      {current ? (
        <Button
          variant="ghost"
          className="self-start"
          label={t('friends.myProfile')}
          onPress={() => router.push({ pathname: '/pessoa', params: { nick: current } })}
        />
      ) : null}
      <View className="flex-row gap-2">
        <Input
          className="flex-1 font-mono"
          value={value}
          onChangeText={setNick}
          accessibilityLabel={t('friends.nick')}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
        />
        <Button
          variant="ghost"
          label={t('friends.saveNick')}
          disabled={!nick || nick.replace(/^@/, '').toLowerCase() === current}
          loading={setUsername.isPending}
          onPress={() => {
            if (!nick) return;
            setUsername.mutate(nick, {
              onSuccess: (saved) => {
                setNick(null);
                toast({ message: t('friends.nickSaved', { nick: saved }) });
              },
              onError: (err) => toast({ message: err.message }),
            });
          }}
        />
      </View>
    </View>
  );
}

function LinkCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { link, reset } = useFriendLink();
  const url = link.data ? inviteUrl(link.data, 'amigo') : null;
  return (
    <View className="gap-3">
      <SectionLabel title={t('friends.link')} className="pt-0" />
      <Text className="text-sm text-ink-muted">{t('friends.linkHint')}</Text>
      {url && (
        <Text
          selectable
          accessibilityLabel={t('friends.link')}
          className="rounded border border-line bg-surface p-3 font-mono text-xs text-ink"
        >
          {url}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        <Button
          icon={Copy}
          label={t('share.copy')}
          disabled={!url}
          onPress={async () => {
            if (!url) return;
            await Clipboard.setStringAsync(url);
            toast({ message: t('share.copied') });
          }}
        />
        {Platform.OS !== 'web' && url && (
          <Button
            variant="ghost"
            icon={Send}
            label={t('share.send')}
            onPress={() => Share.share({ message: t('friends.linkMessage', { link: url }) })}
          />
        )}
        <Button
          variant="ghost"
          icon={RefreshCw}
          label={t('friends.resetLink')}
          onPress={() =>
            reset.mutate(undefined, {
              onSuccess: () => toast({ message: t('friends.linkReset') }),
              onError: (err) => toast({ message: err.message }),
            })
          }
        />
      </View>
    </View>
  );
}
