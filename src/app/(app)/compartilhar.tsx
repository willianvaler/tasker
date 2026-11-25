import { router, useLocalSearchParams } from 'expo-router';
import { FileText, ListPlus, Paperclip, SquarePen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatBytes, isCompressibleImage, MAX_FILE_BYTES } from '@/lib/attachments';
import { setBatchDraft } from '@/lib/batch-draft';
import { cn } from '@/lib/cn';
import { clipNote } from '@/lib/clip';
import { useNoteMutations } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';
import { fileTitle, sharedContent, sharedFile, sharedNotes } from '@/lib/shared-content';

/**
 * O que chegou pelo "Compartilhar" de outro app (PB8, D303): no Android pelo módulo share-intent,
 * na web instalada pelo share_target do manifest (`?title=&text=&url=`). A pessoa escolhe: uma
 * tarefa (com o texto e o link nas notas, na criação com detalhes), uma anotação com a origem (o Web
 * Clipper no celular, OB15) ou uma tarefa por linha (na criação em lote da Caixa de entrada).
 * Imagem ou PDF (CP1, D366) vira anexo da tarefa, escolhendo a lista na criação com detalhes.
 */
export default function SharedScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const today = useToday();
  const toast = useToast();
  const { create } = useNoteMutations();
  const params = useLocalSearchParams<{
    title?: string;
    text?: string;
    url?: string;
    fileUri?: string;
    fileName?: string;
    fileMime?: string;
    fileSize?: string;
  }>();
  const content = sharedContent(params);
  const shared = sharedFile(params, { maxBytes: MAX_FILE_BYTES, compressible: isCompressibleImage });
  const file = shared.file;
  const title = content.title || (params.fileName ? fileTitle(params.fileName) : '');
  const inbox = tree.data?.inbox;
  const all = [content.title, ...content.lines].filter(Boolean);

  function oneTask() {
    router.replace({
      pathname: '/task/new',
      params: {
        title,
        notes: sharedNotes(content),
        ...(file
          ? {
              fileUri: file.uri,
              fileName: file.name,
              fileMime: file.mime ?? '',
              fileSize: file.size == null ? '' : String(file.size),
            }
          : {}),
      },
    });
  }
  // OB15: o Web Clipper pelo celular; o texto e o link viram uma anotação com a origem
  function asNote() {
    const body = content.lines.join('\n\n');
    create
      .mutateAsync(
        clipNote(
          { title: content.title, url: content.url, markdown: body },
          { today, tag: t('clipper.tag') },
        ),
      )
      .then((id) => {
        toast({ message: t('clipper.saved') });
        router.replace({ pathname: '/nota/[id]', params: { id } });
      })
      .catch((err: Error) => toast({ message: t('clipper.failed', { message: err.message }) }));
  }
  function perLine() {
    if (!inbox) return;
    setBatchDraft(inbox.id, all.join('\n'));
    router.replace('/batch');
  }

  return (
    <Screen size="narrow">
      <ScreenHeader title={t('shared.title')} back />
      <ScreenScroll contentContainerClassName={cn(READABLE, 'gap-6 pb-12')}>
        {!title && !content.url ? (
          <EmptyState title={t('shared.empty')} />
        ) : (
          <>
            <View className="gap-1 rounded border border-line bg-surface p-4">
              <Text className="font-serif text-lg text-ink">{title}</Text>
              {!!params.fileName && (
                <View className="flex-row items-center gap-2">
                  <Icon icon={Paperclip} size={16} tone="ink-muted" />
                  <Text className="text-sm text-ink" numberOfLines={1}>
                    {params.fileName}
                    {file?.size != null ? ` · ${formatBytes(file.size)}` : ''}
                  </Text>
                </View>
              )}
              {content.lines.slice(0, 8).map((line, i) => (
                <Text key={i} className="text-sm text-ink" numberOfLines={2}>
                  {line}
                </Text>
              ))}
              {content.lines.length > 8 && (
                <Text className="text-sm text-ink-muted">
                  {t('shared.more', { count: content.lines.length - 8 })}
                </Text>
              )}
              {content.url && (
                <Text
                  testID="shared-url"
                  className="font-mono text-xs text-ink-muted"
                  numberOfLines={1}
                >
                  {content.url}
                </Text>
              )}
            </View>
            {shared.problem && (
              <Text className="text-sm text-danger" accessibilityLiveRegion="polite" aria-live="polite">
                {t(`shared.file.${shared.problem}`)}
              </Text>
            )}
            <View className="gap-2">
              <Button
                icon={SquarePen}
                className="self-start"
                label={params.fileName ? t('shared.oneTaskFile') : t('shared.oneTask')}
                disabled={!!shared.problem}
                onPress={oneTask}
              />
              <Text className="text-sm text-ink-muted">
                {params.fileName ? t('shared.oneTaskFileHint') : t('shared.oneTaskHint')}
              </Text>
            </View>
            {!params.fileName && (
            <View className="gap-2">
              <Button
                variant="ghost"
                icon={FileText}
                className="self-start"
                label={t('shared.asNote')}
                disabled={create.isPending}
                onPress={asNote}
              />
              <Text className="text-sm text-ink-muted">{t('shared.asNoteHint')}</Text>
            </View>
            )}
            {!params.fileName && all.length > 1 && (
              <View className="gap-2">
                <Button
                  variant="ghost"
                  icon={ListPlus}
                  className="self-start"
                  label={t('shared.perLine', { count: all.length })}
                  disabled={!inbox}
                  onPress={perLine}
                />
                <Text className="text-sm text-ink-muted">{t('shared.perLineHint')}</Text>
              </View>
            )}
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
