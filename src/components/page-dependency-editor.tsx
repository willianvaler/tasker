import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { actorCan } from '@/lib/permissions';
import { usePageDepMutations, usePageDeps } from '@/lib/queries/page-deps';
import { rootFolder, useFolderActor } from '@/lib/queries/projects';
import { pageLabel, useTree, type Page } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

const THRESHOLDS = [50, 75, 100] as const;

/**
 * "Libera depois de" (V3 §2.3): a lista só libera quando outra lista do projeto chega a X%.
 * Salva na hora (fora do "Salvar" do diálogo). Mexer pede dependency.manage; quem não tem só vê.
 */
export function PageDependencyEditor({ page }: { page: Page }) {
  const { t } = useTranslation();
  const toast = useToast();
  const tree = useTree();
  const root = rootFolder(tree.data, page.folder_id);
  const actor = useFolderActor(page.folder_id);
  const editable =
    useCanWrite(page.folder_id, { offline: true }) && actorCan(actor, 'dependency.manage');
  const pageDeps = usePageDeps(root);
  const m = usePageDepMutations(root?.id);
  if (!root) return null;

  const folderIds = [root.id, ...root.children.map((c) => c.id)];
  const mine = pageDeps.deps.filter((d) => d.page_id === page.id);
  const others = (tree.data?.pages ?? []).filter(
    (p) =>
      folderIds.includes(p.folder_id) &&
      p.id !== page.id &&
      p.view_type !== 'habits' &&
      !mine.some((d) => d.depends_on_page_id === p.id),
  );
  const nameOf = (id: string) => {
    const p = tree.data?.pages.find((x) => x.id === id);
    return p ? pageLabel(p) : '…';
  };
  const onError = (err: Error) => toast({ message: err.message });

  return (
    <View className="gap-2">
      {mine.map((d) => {
        const progress = pageDeps.progress.get(d.depends_on_page_id);
        const pct = progress?.total ? Math.floor((progress.done * 100) / progress.total) : 100;
        return (
          <View key={d.id} className="gap-1 rounded border border-line p-2">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                {nameOf(d.depends_on_page_id)}
              </Text>
              <Text className="font-mono text-xs text-ink-muted">{t('pageDeps.now', { pct })}</Text>
              {editable && (
                <IconButton
                  icon={X}
                  label={t('pageDeps.unlink', { name: nameOf(d.depends_on_page_id) })}
                  onPress={() => m.remove.mutate(d.id, { onError })}
                />
              )}
            </View>
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              aria-label={t('pageDeps.threshold', { name: nameOf(d.depends_on_page_id) })}
            >
              {THRESHOLDS.map((value) => (
                <Chip
                  key={value}
                  role="radio"
                  label={t('pageDeps.at', { pct: value })}
                  selected={d.threshold_pct === value}
                  disabled={!editable}
                  onPress={() => m.setThreshold.mutate({ id: d.id, threshold: value }, { onError })}
                />
              ))}
            </View>
          </View>
        );
      })}
      {editable && others.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {others.map((p) => (
            <Chip
              key={p.id}
              label={t('pageDeps.add', { name: pageLabel(p) })}
              onPress={() =>
                m.add.mutate({ pageId: page.id, dependsOn: p.id, threshold: 100 }, { onError })
              }
            />
          ))}
        </View>
      )}
      <Text className="text-sm text-ink-muted">{t('pageDeps.hint')}</Text>
    </View>
  );
}
