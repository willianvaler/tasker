import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Globe, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Share, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PersonRow } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useFriendsAccepted } from '@/lib/queries/friends';
import {
  publishedUrl,
  useNotePublication,
  useNotePublicationActions,
  useNoteShareActions,
  useNoteShares,
} from '@/lib/queries/note-shares';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Compartilhar e publicar uma anotação pessoal (OB14, D300): com amigos, para ler ou editar, e
// num endereço público só de leitura (/p/<token>), com senha opcional. Tudo pelo servidor: sem
// internet, a tela só explica.

type Role = 'read' | 'edit';

export function NoteShareDialog({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  return (
    <DialogFrame onClose={onClose} wide>
      <View className="flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
          {t('noteShare.title')}
        </Text>
        <IconButton icon={X} label={t('common.close')} tone="ink" onPress={onClose} />
      </View>
      {!online ? (
        <Text className="text-sm text-warn">{t('noteShare.offline')}</Text>
      ) : (
        <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
          <People noteId={noteId} />
          <Publish noteId={noteId} />
        </ScrollView>
      )}
    </DialogFrame>
  );
}

function People({ noteId }: { noteId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const shares = useNoteShares();
  const friends = useFriendsAccepted();
  const { share, unshare } = useNoteShareActions();
  const [role, setRole] = useState<Role>('read');
  const mine = (shares.data ?? []).filter((s) => s.note_id === noteId);
  const inside = new Set(mine.map((s) => s.user_id));
  const candidates = (friends.data ?? []).filter((f) => !inside.has(f.user_id));
  const fail = (err: Error) => toast({ message: err.message });
  const roleLabel = (r: Role) => t(r === 'edit' ? 'noteShare.roleEdit' : 'noteShare.roleRead');

  return (
    <View className="gap-2">
      <SectionLabel
        title={t('noteShare.people')}
        count={mine.length || undefined}
        className="pt-0"
      />
      <Text className="text-sm text-ink-muted">{t('noteShare.peopleHint')}</Text>
      {mine.map((s) => (
        <PersonRow
          key={s.user_id}
          name={s.name || t('noteShare.someone')}
          detail={roleLabel(s.role)}
          right={
            <View className="flex-row gap-1">
              <Button
                variant="ghost"
                label={s.role === 'edit' ? t('noteShare.makeRead') : t('noteShare.makeEdit')}
                onPress={() =>
                  share
                    .mutateAsync({
                      noteId,
                      userId: s.user_id,
                      role: s.role === 'edit' ? 'read' : 'edit',
                    })
                    .catch(fail)
                }
              />
              <Button
                variant="ghost"
                destructive
                label={t('noteShare.remove')}
                onPress={() => unshare.mutateAsync({ noteId, userId: s.user_id }).catch(fail)}
              />
            </View>
          }
        />
      ))}
      {friends.data && friends.data.length === 0 ? (
        <View className="gap-2 py-1">
          <Text className="text-sm text-ink-muted">{t('friendPicker.none')}</Text>
          <Button
            variant="ghost"
            className="self-start"
            label={t('friendPicker.addFriends')}
            onPress={() => router.push('/amigos')}
          />
        </View>
      ) : (
        candidates.length > 0 && (
          <>
            <View className="flex-row flex-wrap items-center gap-2 pt-2">
              <Text className="text-sm text-ink">{t('noteShare.addAs')}</Text>
              {(['read', 'edit'] as const).map((r) => (
                <Chip
                  key={r}
                  role="radio"
                  label={roleLabel(r)}
                  selected={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </View>
            {candidates.map((f) => (
              <PersonRow
                key={f.user_id}
                name={f.display_name}
                detail={`@${f.username}`}
                right={
                  <Button
                    variant="ghost"
                    label={t('noteShare.add')}
                    disabled={share.isPending}
                    onPress={() =>
                      share
                        .mutateAsync({ noteId, userId: f.user_id, role })
                        .then(() =>
                          toast({ message: t('noteShare.added', { name: f.display_name }) }),
                        )
                        .catch(fail)
                    }
                  />
                }
              />
            ))}
          </>
        )
      )}
    </View>
  );
}

function Publish({ noteId }: { noteId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const publication = useNotePublication(noteId);
  const { publish, unpublish } = useNotePublicationActions(noteId);
  const [password, setPassword] = useState('');
  const pub = publication.data;
  const fail = (err: Error) => toast({ message: err.message });
  const url = pub ? publishedUrl(pub.token) : '';

  async function copy() {
    await Clipboard.setStringAsync(url).catch(() => {});
    toast({ message: t('noteShare.copied') });
    if (Platform.OS !== 'web') Share.share({ message: url }).catch(() => {});
  }

  return (
    <View className="gap-2">
      <SectionLabel title={t('noteShare.publish')} />
      <Text className="text-sm text-ink-muted">{t('noteShare.publishHint')}</Text>
      {publication.isPending ? null : !pub ? (
        <Button
          icon={Globe}
          className="self-start"
          label={t('noteShare.publishNow')}
          disabled={publish.isPending}
          onPress={() => publish.mutateAsync({ includeLinked: false }).catch(fail)}
        />
      ) : (
        <View className="gap-3">
          <View className="flex-row items-center gap-2 rounded bg-wash px-3 py-2">
            <Text
              testID="published-url"
              selectable
              className="flex-1 font-mono text-xs text-ink"
              numberOfLines={1}
            >
              {url}
            </Text>
            <IconButton icon={Copy} label={t('noteShare.copy')} tone="ink" onPress={copy} />
          </View>
          <ToggleRow
            title={t('noteShare.includeLinked')}
            hint={t('noteShare.includeLinkedHint')}
            value={pub.include_linked}
            onChange={(value) => publish.mutateAsync({ includeLinked: value }).catch(fail)}
          />
          <Text className="text-sm text-ink">
            {pub.has_password ? t('noteShare.hasPassword') : t('noteShare.noPassword')}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              maxLength={72}
              placeholder={t('noteShare.passwordPlaceholder')}
              accessibilityLabel={t('noteShare.passwordPlaceholder')}
              className="min-w-48 flex-1"
            />
            <Button
              variant="ghost"
              label={t('noteShare.setPassword')}
              disabled={password.length < 4 || publish.isPending}
              onPress={() =>
                publish
                  .mutateAsync({ includeLinked: pub.include_linked, password })
                  .then(() => {
                    setPassword('');
                    toast({ message: t('noteShare.passwordSet') });
                  })
                  .catch(fail)
              }
            />
            {pub.has_password && (
              <Button
                variant="ghost"
                label={t('noteShare.removePassword')}
                onPress={() =>
                  publish
                    .mutateAsync({ includeLinked: pub.include_linked, password: '' })
                    .catch(fail)
                }
              />
            )}
          </View>
          <Button
            variant="ghost"
            destructive
            className="self-start"
            label={t('noteShare.unpublish')}
            onPress={() => unpublish.mutateAsync().catch(fail)}
          />
        </View>
      )}
    </View>
  );
}
