import { Link } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFrame } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { actorCan } from '@/lib/permissions';
import {
  useGroupLinkedPages,
  usePageGroupMutations,
  usePageGroupOptions,
} from '@/lib/queries/page-groups';
import { useFolderActor } from '@/lib/queries/projects';
import type { Page } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

/**
 * "Adicionar a um grupo" (AC15B): marcar os grupos de treino em que este treino da Academia
 * aparece. O treino continua aqui; quem é do grupo o recebe ao vivo e treina com o próprio diário.
 */
export function PageGroupsDialog({ page, onClose }: { page: Page; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const options = usePageGroupOptions(page.id);
  const m = usePageGroupMutations();
  const [picked, setPicked] = useState<string[] | null>(null);
  const groups = options.data ?? [];
  const chosen = picked ?? groups.filter((g) => g.linked).map((g) => g.folder_id);

  const toggle = (id: string, on: boolean) =>
    setPicked(on ? [...chosen, id] : chosen.filter((x) => x !== id));

  function save() {
    m.set.mutate(
      { pageId: page.id, folderIds: chosen },
      {
        onSuccess: () => {
          toast({ message: t('pageGroups.saved', { count: chosen.length }) });
          onClose();
        },
        onError: (e) => toast({ message: t('page.error', { message: e.message }) }),
      },
    );
  }

  return (
    <DialogFrame onClose={onClose} wide>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {t('pageGroups.title')}
      </Text>
      <Text className="text-sm text-ink-muted">{t('pageGroups.hint')}</Text>
      {options.data && groups.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('pageGroups.none')}</Text>
      ) : (
        <ScrollView style={{ maxHeight: 320 }} className="border-y border-line">
          {groups.map((group) => (
            <View
              key={group.folder_id}
              className="flex-row items-center gap-2 border-b border-line"
            >
              <Checkbox
                checked={chosen.includes(group.folder_id)}
                label={group.name}
                onChange={(on) => toggle(group.folder_id, on)}
              />
              <ItemIcon icon={group.icon} kind="project" />
              <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                {group.name}
              </Text>
              <Text className="pr-2 font-mono text-xs text-ink-muted">
                {t('pageGroups.members', { count: group.members })}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
      <View className="flex-row flex-wrap justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        {groups.length > 0 && (
          <Button
            label={t('common.save')}
            loading={m.set.isPending}
            disabled={picked === null || m.set.isPending}
            onPress={save}
          />
        )}
      </View>
    </DialogFrame>
  );
}

/**
 * Os treinos que membros puseram no grupo (a outra visão do vínculo), com quem pôs. Tira do grupo
 * quem pôs ou quem gerencia o grupo.
 */
export function GroupLinkedPages({ folderId, indent }: { folderId: string; indent?: boolean }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const me = useSession().session?.user.id;
  const canManage = actorCan(useFolderActor(folderId), 'page.manage');
  const linked = useGroupLinkedPages(online ? folderId : undefined);
  const m = usePageGroupMutations();
  const toast = useToast();
  return (
    <>
      {(linked.data ?? []).map((page) => (
        <View key={page.page_id} className="flex-row items-center border-b border-line">
          <Link href={{ pathname: '/page/[id]', params: { id: page.page_id } }} asChild>
            <Pressable
              accessibilityRole="link"
              className={
                indent
                  ? 'min-h-11 flex-1 flex-row items-center gap-3 pl-8 pr-2 hover:bg-wash md:min-h-10'
                  : 'min-h-11 flex-1 flex-row items-center gap-3 px-2 hover:bg-wash md:min-h-10'
              }
            >
              <ItemIcon icon={page.icon} kind={page.view_type as ItemKind} />
              <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                {page.name}
              </Text>
              <Text className="font-mono text-xs text-ink-muted" numberOfLines={1}>
                {page.owner_id === me
                  ? t('pageGroups.yours')
                  : t('pageGroups.from', { name: page.owner_name ?? t('common.someone') })}
              </Text>
            </Pressable>
          </Link>
          {(canManage || page.owner_id === me) && (
            <IconButton
              icon={X}
              label={t('pageGroups.remove', { name: page.name })}
              onPress={() =>
                m.unlink.mutate(
                  { pageId: page.page_id, folderId },
                  { onError: (e) => toast({ message: t('page.error', { message: e.message }) }) },
                )
              }
            />
          )}
        </View>
      ))}
    </>
  );
}
