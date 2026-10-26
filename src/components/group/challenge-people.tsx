import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, KeyRound, RefreshCw, Send, UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Share, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog, DialogFrame } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import {
  challengeUrl,
  useChallengeMutations,
  useChallengePeople,
  type BoardRow,
  type Challenge,
} from '@/lib/queries/challenges';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/**
 * Quem dá para trazer (amigos, times, grupos e outros desafios), marcando com caixas. Quem já está
 * fica de fora.
 */
export function PeoplePicker({
  picked,
  onChange,
  exclude = [],
}: {
  picked: string[];
  onChange: (picked: string[]) => void;
  exclude?: string[];
}) {
  const { t } = useTranslation();
  const people = useChallengePeople();
  const list = (people.data ?? []).filter((p) => !exclude.includes(p.user_id));
  if (people.data && list.length === 0) {
    return (
      <Text className="text-sm text-ink-muted">
        {exclude.length > 1 ? t('challenge.noneToAdd') : t('challenge.create.noPeople')}
      </Text>
    );
  }
  return (
    <ScrollView style={{ maxHeight: 320 }} className="border-y border-line">
      {list.map((person) => (
        <View key={person.user_id} className="flex-row items-center gap-2 border-b border-line">
          <Checkbox
            checked={picked.includes(person.user_id)}
            label={person.display_name}
            onChange={(on) =>
              onChange(
                on ? [...picked, person.user_id] : picked.filter((id) => id !== person.user_id),
              )
            }
          />
          <Avatar name={person.display_name} size={20} />
          <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
            {person.display_name}
          </Text>
          <Text className="pr-2 font-mono text-xs text-ink-muted">
            {t(`challenge.source.${person.source as 'friend'}`)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

type Confirm = { kind: 'remove'; userId: string; name: string } | { kind: 'leave' | 'delete' };

/**
 * Pessoas do desafio (AC15C): quem está, o código e o link para entrar, e o que cada um pode
 * fazer: quem criou traz e tira gente, troca ou cancela o código e apaga; os outros saem.
 */
export function ChallengePeople({ challenge, rows }: { challenge: Challenge; rows: BoardRow[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const me = useSession().session?.user.id;
  const m = useChallengeMutations();
  const mine = challenge.created_by === me;
  const over = !!challenge.finished_at;
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const onError = (e: Error) => toast({ message: t('page.error', { message: e.message }) });
  const url = challenge.code ? challengeUrl(challenge.code) : null;
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.user_id === challenge.created_by) - Number(a.user_id === challenge.created_by) ||
      a.display_name.localeCompare(b.display_name),
  );

  return (
    <View className="gap-6">
      {!over && (
        <View className="gap-3">
          <SectionLabel title={t('challenge.code.title')} className="pt-0" />
          {challenge.code && url ? (
            <>
              <Text className="text-sm text-ink-muted">{t('challenge.code.hint')}</Text>
              <Text
                selectable
                accessibilityLabel={t('challenge.code.title')}
                className="self-start rounded border border-line bg-surface px-3 py-2 font-mono text-xl tracking-widest text-ink"
              >
                {challenge.code}
              </Text>
              <Text selectable className="font-mono text-xs text-ink-muted">
                {url}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Button
                  icon={Copy}
                  label={t('challenge.code.copy')}
                  onPress={async () => {
                    await Clipboard.setStringAsync(url);
                    toast({ message: t('share.copied') });
                  }}
                />
                {Platform.OS !== 'web' && (
                  <Button
                    variant="ghost"
                    icon={Send}
                    label={t('challenge.code.send')}
                    onPress={() =>
                      Share.share({
                        message: t('challenge.code.message', {
                          name: challenge.name,
                          link: url,
                          code: challenge.code,
                        }),
                      })
                    }
                  />
                )}
                {mine && (
                  <>
                    <Button
                      variant="ghost"
                      icon={RefreshCw}
                      label={t('challenge.code.renew')}
                      onPress={() =>
                        m.code.mutate(
                          { id: challenge.id, enabled: true },
                          {
                            onSuccess: () => toast({ message: t('challenge.code.renewed') }),
                            onError,
                          },
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      destructive
                      label={t('challenge.code.cancel')}
                      onPress={() =>
                        m.code.mutate(
                          { id: challenge.id, enabled: false },
                          {
                            onSuccess: () => toast({ message: t('challenge.code.canceled') }),
                            onError,
                          },
                        )
                      }
                    />
                  </>
                )}
              </View>
            </>
          ) : (
            <>
              <Text className="text-sm text-ink-muted">{t('challenge.code.none')}</Text>
              {mine && (
                <Button
                  icon={KeyRound}
                  className="self-start"
                  label={t('challenge.code.enable')}
                  onPress={() => m.code.mutate({ id: challenge.id, enabled: true }, { onError })}
                />
              )}
            </>
          )}
        </View>
      )}

      <View>
        <SectionLabel
          title={t('challenge.people')}
          count={rows.length}
          className="pt-0"
          right={
            mine && !over ? (
              <Button
                variant="ghost"
                icon={UserPlus}
                label={t('challenge.add')}
                onPress={() => {
                  setPicked([]);
                  setAdding(true);
                }}
              />
            ) : undefined
          }
        />
        {sorted.map((row) => (
          <View
            key={row.user_id}
            className="min-h-11 flex-row items-center gap-3 border-b border-line px-2"
          >
            <Avatar name={row.display_name} size={20} />
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {row.user_id === me ? t('group.you') : row.display_name}
            </Text>
            {row.user_id === challenge.created_by && (
              <Text className="font-mono text-xs text-ink-muted">{t('challenge.creator')}</Text>
            )}
            {mine && row.user_id !== me && (
              <IconButton
                icon={X}
                label={t('challenge.remove', { name: row.display_name })}
                onPress={() =>
                  setConfirm({ kind: 'remove', userId: row.user_id, name: row.display_name })
                }
              />
            )}
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {mine ? (
          <Button
            variant="ghost"
            destructive
            label={t('challenge.delete')}
            onPress={() => setConfirm({ kind: 'delete' })}
          />
        ) : (
          <Button
            variant="ghost"
            destructive
            label={t('challenge.leave')}
            onPress={() => setConfirm({ kind: 'leave' })}
          />
        )}
      </View>

      {adding && (
        <DialogFrame onClose={() => setAdding(false)} wide>
          <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
            {t('challenge.add')}
          </Text>
          <PeoplePicker picked={picked} onChange={setPicked} exclude={rows.map((r) => r.user_id)} />
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setAdding(false)} />
            <Button
              label={t('challenge.add')}
              disabled={picked.length === 0}
              loading={m.add.isPending}
              onPress={() =>
                m.add.mutate(
                  { id: challenge.id, members: picked },
                  {
                    onSuccess: () => {
                      toast({ message: t('challenge.added', { count: picked.length }) });
                      setAdding(false);
                    },
                    onError,
                  },
                )
              }
            />
          </View>
        </DialogFrame>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'remove'
              ? t('challenge.removeTitle', { name: confirm.name })
              : confirm.kind === 'leave'
                ? t('challenge.leaveTitle', { name: challenge.name })
                : t('challenge.deleteTitle', { name: challenge.name })
          }
          message={
            confirm.kind === 'remove'
              ? t('challenge.removeMessage')
              : confirm.kind === 'leave'
                ? t('challenge.leaveMessage')
                : t('challenge.deleteMessage')
          }
          confirmLabel={
            confirm.kind === 'remove'
              ? t('challenge.remove', { name: confirm.name })
              : confirm.kind === 'leave'
                ? t('challenge.leave')
                : t('challenge.delete')
          }
          destructive
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            if (confirm.kind === 'remove') {
              m.removeMember.mutate({ id: challenge.id, userId: confirm.userId }, { onError });
            } else if (confirm.kind === 'leave') {
              if (!me) return;
              m.removeMember
                .mutateAsync({ id: challenge.id, userId: me })
                .then(() => router.replace('/treino'), onError);
            } else {
              m.remove.mutateAsync(challenge.id).then(() => router.replace('/treino'), onError);
            }
          }}
        />
      )}
    </View>
  );
}
