import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DialogFrame } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { formatBytes } from '@/lib/attachments';
import { cn } from '@/lib/cn';
import { wordCount } from '@/lib/note-blocks';
import {
  useNoteVersionMutations,
  useNoteVersions,
  type NoteVersion,
  type RestoredNote,
} from '@/lib/queries/note-versions';
import { collapseDiff, diffLines, diffStats } from '@/lib/text-diff';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Histórico de versões da anotação (OB11, D296): a lista das versões, a diferença de cada uma
// para o texto de agora, restaurar e apagar. Restaurar devolve o texto para o editor, que troca o
// que mostra sem gravar por cima.

type Current = { title: string; body: string };

export function NoteHistory({
  noteId,
  current,
  canEdit,
  onRestored,
  onClose,
}: {
  noteId: string;
  current: Current;
  canEdit: boolean;
  onRestored: (note: RestoredNote) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const versions = useNoteVersions(noteId);
  const m = useNoteVersionMutations(noteId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'restore' | 'delete' | null>(null);
  const wide = useWindowDimensions().width >= 768;
  const list = versions.data ?? [];
  const selected = list.find((v) => v.id === selectedId) ?? list[0];
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const date = (v: NoteVersion) => when.format(new Date(v.created_at));

  function restore(version: NoteVersion) {
    m.restore
      .mutateAsync(version)
      .then((note) => {
        onRestored(note);
        toast({ message: t('noteHistory.restored', { date: date(version) }) });
        onClose();
      })
      .catch((err: Error) => toast({ message: t('noteHistory.error', { message: err.message }) }));
  }

  return (
    <DialogFrame onClose={onClose} wide="xl">
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {t('noteHistory.title')}
      </Text>
      {!online ? (
        <Text className="text-sm text-warn">{t('noteHistory.offline')}</Text>
      ) : versions.error ? (
        <Text className="text-sm text-danger">
          {t('noteHistory.error', { message: versions.error.message })}
        </Text>
      ) : versions.data && list.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('noteHistory.empty')}</Text>
      ) : (
        <View className={cn('min-h-0 shrink gap-4', wide && 'flex-row')} style={{ height: 460 }}>
          <ScrollView
            accessibilityRole="list"
            aria-label={t('noteHistory.list')}
            style={wide ? { width: 220, flexGrow: 0 } : { maxHeight: 150, flexGrow: 0 }}
          >
            {list.map((v) => (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                aria-selected={v.id === selected?.id}
                onPress={() => {
                  setSelectedId(v.id);
                  setConfirm(null);
                }}
                className={cn(
                  'gap-1 rounded px-2 py-2',
                  v.id === selected?.id ? 'bg-wash' : 'hover:bg-wash',
                )}
              >
                <Text className="text-sm text-ink">{date(v)}</Text>
                <Text className="text-xs text-ink-muted">
                  {t('notes.words', { count: wordCount(v.body) })} ·{' '}
                  {formatBytes(v.size, i18n.language)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {selected && (
            <View className="min-h-0 flex-1 gap-2">
              <VersionDiff version={selected} current={current} />
              {confirm ? (
                <View className="gap-2 rounded-lg bg-wash p-3">
                  <Text className="text-sm text-ink">
                    {t(confirm === 'restore' ? 'noteHistory.confirmRestore' : 'noteHistory.confirmDelete', {
                      date: date(selected),
                    })}
                  </Text>
                  <View className="flex-row flex-wrap justify-end gap-2">
                    <Button
                      variant="ghost"
                      label={t('common.cancel')}
                      onPress={() => setConfirm(null)}
                    />
                    <Button
                      destructive={confirm === 'delete'}
                      label={t(confirm === 'restore' ? 'noteHistory.restore' : 'noteHistory.delete')}
                      disabled={m.restore.isPending}
                      onPress={() => {
                        setConfirm(null);
                        if (confirm === 'restore') restore(selected);
                        else
                          m.remove.mutate(selected.id, {
                            onError: (err) =>
                              toast({ message: t('noteHistory.error', { message: err.message }) }),
                          });
                      }}
                    />
                  </View>
                </View>
              ) : (
                <View className="flex-row flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    destructive
                    label={t('noteHistory.delete')}
                    onPress={() => setConfirm('delete')}
                  />
                  {canEdit && (
                    <Button label={t('noteHistory.restore')} onPress={() => setConfirm('restore')} />
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
      <Text className="text-xs text-ink-muted">{t('noteHistory.hint')}</Text>
      <Button variant="ghost" label={t('common.close')} onPress={onClose} className="self-end" />
    </DialogFrame>
  );
}

/** O que muda se voltar a esta versão: − está só nela, + está só no texto de agora */
function VersionDiff({ version, current }: { version: NoteVersion; current: Current }) {
  const { t } = useTranslation();
  const lines = diffLines(version.body, current.body);
  const stats = diffStats(lines);
  const chunks = collapseDiff(lines);
  const sameTitle = version.title.trim() === current.title.trim();
  return (
    <View className="min-h-0 flex-1 gap-2">
      <Text className="text-xs text-ink-muted">
        {stats.added + stats.removed === 0 && sameTitle
          ? t('noteHistory.same')
          : t('noteHistory.legend', { removed: stats.removed, added: stats.added })}
      </Text>
      {!sameTitle && (
        <Text className="text-sm text-ink">
          {t('noteHistory.titleWas', { title: version.title.trim() || t('notes.untitled') })}
        </Text>
      )}
      <ScrollView
        testID="version-diff"
        className="flex-1 rounded border border-line"
        contentContainerClassName="py-1"
      >
        {chunks.map((c, i) =>
          c.type === 'skip' ? (
            <Text key={i} className="px-2 py-1 text-xs italic text-ink-muted">
              {t('noteHistory.unchanged', { count: c.count })}
            </Text>
          ) : (
            <View
              key={i}
              className={cn(
                'flex-row gap-2 px-2',
                c.type === 'del' && 'bg-danger/10',
                c.type === 'add' && 'bg-ok/10',
              )}
            >
              <Text
                aria-hidden
                className={cn(
                  'w-3 font-mono text-xs leading-5',
                  c.type === 'del' ? 'text-danger' : c.type === 'add' ? 'text-ok' : 'text-ink-muted',
                )}
              >
                {c.type === 'del' ? '−' : c.type === 'add' ? '+' : ' '}
              </Text>
              <Text
                accessibilityLabel={
                  c.type === 'same'
                    ? undefined
                    : `${t(c.type === 'del' ? 'noteHistory.onlyVersion' : 'noteHistory.onlyNow')}: ${c.text}`
                }
                className={cn(
                  'flex-1 font-mono text-xs leading-5',
                  c.type === 'same' ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {c.text || ' '}
              </Text>
            </View>
          ),
        )}
      </ScrollView>
    </View>
  );
}
