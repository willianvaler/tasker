import { router, useLocalSearchParams } from 'expo-router';
import { FileText, ListPlus, SquarePen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { setBatchDraft } from '@/lib/batch-draft';
import { cn } from '@/lib/cn';
import { clipNote } from '@/lib/clip';
import { useNoteMutations } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';
import { sharedContent, sharedNotes } from '@/lib/shared-content';

/**
 * O que chegou pelo "Compartilhar" de outro app (PB8, D303): no Android pelo módulo share-intent,
 * na web instalada pelo share_target do manifest (`?title=&text=&url=`). A pessoa escolhe: uma
 * tarefa (com o texto e o link nas notas, na criação com detalhes), uma anotação com a origem (o Web
 * Clipper no celular, OB15) ou uma tarefa por linha (na criação em lote da Caixa de entrada).
 */
export default function SharedScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const today = useToday();
  const toast = useToast();
  const { create } = useNoteMutations();
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const content = sharedContent(params);
  const inbox = tree.data?.inbox;
  const all = [content.title, ...content.lines].filter(Boolean);

  function oneTask() {
    router.replace({
      pathname: '/task/new',
      params: { title: content.title, notes: sharedNotes(content) },
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
        {!content.title && !content.url ? (
          <EmptyState title={t('shared.empty')} />
        ) : (
          <>
            <View className="gap-1 rounded border border-line bg-surface p-4">
              <Text className="font-serif text-lg text-ink">{content.title}</Text>
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
            <View className="gap-2">
              <Button
                icon={SquarePen}
                className="self-start"
                label={t('shared.oneTask')}
                onPress={oneTask}
              />
              <Text className="text-sm text-ink-muted">{t('shared.oneTaskHint')}</Text>
            </View>
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
            {all.length > 1 && (
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
