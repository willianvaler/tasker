import { router } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { clipNote, decodeClip } from '@/lib/clip';
import { takeStashedClip } from '@/lib/clip-stash';
import { cn } from '@/lib/cn';
import { plainText } from '@/lib/markdown-edit';
import { useNoteMutations } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { hostOf } from '@/lib/shared-content';
import { useToast } from '@/providers/toast';

/**
 * Recorte da extensão do navegador (OB15, D305): a página (ou o trecho selecionado) em Markdown,
 * com a origem. Um toque salva como anotação pessoal e abre ela.
 */
export default function ClipScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const toast = useToast();
  const { create } = useNoteMutations();
  // O recorte foi guardado na carga do app (lib/clip-stash) e sai de lá aqui, uma vez só
  const [clip] = useState(() => {
    const raw = takeStashedClip();
    return raw ? decodeClip(raw) : null;
  });

  function save() {
    if (!clip) return;
    create
      .mutateAsync(clipNote(clip, { today, tag: t('clipper.tag') }))
      .then((id) => {
        toast({ message: t('clipper.saved') });
        router.replace({ pathname: '/nota/[id]', params: { id } });
      })
      .catch((err: Error) => toast({ message: t('clipper.failed', { message: err.message }) }));
  }

  const preview = clip ? plainText(clip.markdown).trim().split('\n').filter(Boolean) : [];
  return (
    <Screen size="narrow">
      <ScreenHeader title={t('clipper.title')} back />
      <ScreenScroll contentContainerClassName={cn(READABLE, 'gap-6 pb-12')}>
        {!clip ? (
          <EmptyState title={t('clipper.empty')} hint={t('clipper.emptyHint')} />
        ) : (
          <>
            <View className="gap-2 rounded border border-line bg-surface p-4">
              <Text className="font-serif text-lg text-ink">{clip.title}</Text>
              <Text className="text-xs text-ink-muted">
                {[
                  hostOf(clip.url),
                  clip.author,
                  clip.selection ? t('clipper.selection') : t('clipper.page'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {preview.slice(0, 6).map((line, i) => (
                <Text key={i} className="text-sm text-ink" numberOfLines={2}>
                  {line}
                </Text>
              ))}
              {preview.length > 6 && (
                <Text className="text-sm text-ink-muted">
                  {t('shared.more', { count: preview.length - 6 })}
                </Text>
              )}
            </View>
            <Button
              icon={FileText}
              className="self-start"
              label={t('clipper.save')}
              disabled={create.isPending}
              onPress={save}
            />
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}
