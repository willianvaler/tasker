import { router, useLocalSearchParams } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, PromptDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useCommunityActions, useCommunityPost, type SnapshotItem } from '@/lib/queries/community';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/** Prévia de uma publicação da comunidade (D233): o que vem, e Usar, Curtir, Denunciar. */
export default function CommunityPostScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useCommunityPost(id);
  const actions = useCommunityActions();
  const toast = useToast();
  const online = useIsOnline();
  const [dialog, setDialog] = useState<'report' | 'unpublish' | null>(null);
  const data = post.data;
  const onError = (err: Error) => toast({ message: err.message });

  if (!post.isPending && !data)
    return (
      <Screen size="medium">
        <ScreenHeader title={t('community.title')} back />
        <EmptyState title={t('community.missing')} />
      </Screen>
    );

  return (
    <Screen size="medium">
      <ScreenHeader
        title={data ? `${data.icon ? `${data.icon} ` : ''}${data.title}` : '…'}
        eyebrow={
          data ? `${t(`community.kind.${data.kind}`)} · @${data.author_username}` : undefined
        }
        back
      />
      <ScreenScroll contentContainerClassName="gap-6 pb-12">
        {data?.description ? <Text className="text-sm text-ink">{data.description}</Text> : null}
        {data && (
          <View className="flex-row flex-wrap items-center gap-2">
            <Button
              label={t('community.use')}
              loading={actions.use.isPending}
              disabled={!online}
              onPress={() =>
                actions.use.mutate(data.id, {
                  onSuccess: (folderId) => {
                    toast({ message: t('community.used', { title: data.title }) });
                    if (folderId)
                      router.replace({ pathname: '/folder/[id]', params: { id: folderId } });
                  },
                  onError,
                })
              }
            />
            {!data.mine && (
              <Button
                variant="ghost"
                icon={Heart}
                label={t(data.liked ? 'community.liked' : 'community.like', { count: data.likes })}
                aria-pressed={data.liked}
                disabled={!online}
                onPress={() => actions.like.mutate({ id: data.id, on: !data.liked }, { onError })}
              />
            )}
            {!data.mine && (
              <Button
                variant="ghost"
                label={t('community.report')}
                disabled={!online}
                onPress={() => setDialog('report')}
              />
            )}
            {data.mine && (
              <Button
                variant="ghost"
                label={t('community.unpublish')}
                disabled={!online}
                onPress={() => setDialog('unpublish')}
              />
            )}
          </View>
        )}
        {data && (
          <Text className="font-mono text-xs text-ink-muted">
            {`${t('community.uses', { count: data.uses })} · ♥ ${data.likes}`}
          </Text>
        )}
        {data?.data.pages.map((page, i) => (
          <View key={i} className="gap-1">
            <SectionLabel
              title={`${page.icon ? `${page.icon} ` : ''}${page.name}`}
              count={page.items.length}
              className="pt-0"
            />
            {page.items.slice(0, 40).map((item, j) => (
              <ItemLine key={j} item={item} level={0} />
            ))}
            {page.items.length > 40 && (
              <Text className="text-xs text-ink-muted">
                {t('community.more', { count: page.items.length - 40 })}
              </Text>
            )}
          </View>
        ))}
        <Text className="text-xs text-ink-muted">{t('community.copyHint')}</Text>
      </ScreenScroll>
      {data && dialog === 'report' && (
        <PromptDialog
          title={t('community.reportTitle')}
          message={t('community.reportMessage')}
          fields={[{ key: 'reason', placeholder: t('community.reportPlaceholder') }]}
          validate={() => true}
          confirmLabel={t('community.report')}
          onClose={() => setDialog(null)}
          onConfirm={({ reason }) => {
            setDialog(null);
            actions.report.mutate(
              { id: data.id, reason },
              { onSuccess: () => toast({ message: t('community.reported') }), onError },
            );
          }}
        />
      )}
      {data && dialog === 'unpublish' && (
        <ConfirmDialog
          title={t('community.unpublishTitle', { title: data.title })}
          message={t('community.unpublishMessage')}
          confirmLabel={t('community.unpublish')}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            actions.unpublish.mutate(data.id, {
              onSuccess: () => {
                toast({ message: t('community.unpublished') });
                router.back();
              },
              onError,
            });
          }}
        />
      )}
    </Screen>
  );
}

function ItemLine({ item, level }: { item: SnapshotItem; level: number }) {
  return (
    <>
      <Text className="py-1 text-sm text-ink" style={{ paddingLeft: level * 16 }}>
        {`${level ? '· ' : '☐ '}${item.title}`}
      </Text>
      {level < 2 && item.children?.map((c, i) => <ItemLine key={i} item={c} level={level + 1} />)}
    </>
  );
}
