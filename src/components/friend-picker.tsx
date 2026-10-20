import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PersonRow } from '@/components/ui/person';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useFriendsAccepted } from '@/lib/queries/friends';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/** Onde o amigo entra: um projeto (ou grupo de treino), um time ou o meu clã. */
export type FriendTarget =
  | { folderId: string; role?: 'manager' | 'editor' | 'contributor' | 'viewer' }
  | { teamId: string }
  | { clan: true };

/**
 * Adicionar da lista de amigos (ESCOPO_V10 §3, D231): os amigos que ainda não estão no grupo, com
 * "Adicionar". Entra direto (a amizade é o consentimento) e a pessoa recebe um aviso.
 */
export function FriendPicker({
  target,
  memberIds,
  onAdded,
}: {
  target: FriendTarget;
  /** Quem já está no grupo (fica de fora da lista) */
  memberIds: string[];
  onAdded?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const queryClient = useQueryClient();
  const friends = useFriendsAccepted();
  const add = useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase.rpc('add_friend_to_group', {
        p_friend: friendId,
        ...('folderId' in target
          ? { p_folder_id: target.folderId, p_role: target.role ?? 'contributor' }
          : 'teamId' in target
            ? { p_team_id: target.teamId }
            : { p_clan: true }),
      });
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['clan'] });
      onAdded?.();
    },
  });

  const inGroup = new Set(memberIds);
  const candidates = (friends.data ?? []).filter((f) => !inGroup.has(f.user_id));

  return (
    <View className="gap-1">
      <SectionLabel title={t('friendPicker.title')} count={candidates.length} className="pt-0" />
      {friends.data && friends.data.length === 0 ? (
        <View className="gap-2 py-2">
          <Text className="text-sm text-ink-muted">{t('friendPicker.none')}</Text>
          <Button
            variant="ghost"
            className="self-start"
            label={t('friendPicker.addFriends')}
            onPress={() => router.push('/amigos')}
          />
        </View>
      ) : candidates.length === 0 ? (
        <Text className="py-2 text-sm text-ink-muted">{t('friendPicker.allIn')}</Text>
      ) : (
        candidates.map((f) => (
          <PersonRow
            key={f.user_id}
            name={f.display_name}
            detail={`@${f.username}`}
            right={
              <Button
                variant="ghost"
                label={t('friendPicker.add')}
                accessibilityLabel={t('friendPicker.addLabel', { name: f.display_name })}
                disabled={!online || add.isPending}
                onPress={() =>
                  add.mutate(f.user_id, {
                    onSuccess: () =>
                      toast({ message: t('friendPicker.added', { name: f.display_name }) }),
                    onError: (err) => toast({ message: err.message }),
                  })
                }
              />
            }
          />
        ))
      )}
    </View>
  );
}
