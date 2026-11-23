import { AppWindow, FileText, Link2, NotebookText, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { openMaterial } from '@/components/materials-section';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFrame } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { materialsForTask, type TaskMaterial } from '@/lib/material-links';
import { materialTitle } from '@/lib/materials';
import {
  useMaterialLinkMutations,
  useMaterialLinks,
  useProjectMaterials,
} from '@/lib/queries/materials';
import { usePageTasks } from '@/lib/queries/tasks';
import { findFolder, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const iconFor = (m: { note_id: string | null; mime: string | null }) =>
  m.note_id ? NotebookText : m.mime === 'text/html' ? AppWindow : FileText;

/**
 * Material da tarefa (ES6, D327): o que está ligado a ela (pelo código no nome do arquivo ou à
 * mão), ou o que ela herda da tarefa mãe ou da lista. Tocar abre no leitor; quem edita a tarefa
 * liga e desliga. Some quando o projeto não tem material.
 */
export function TaskMaterials({
  task,
  editable,
}: {
  task: {
    id: string;
    page_id: string | null;
    folder_id: string | null;
    parent_task_id?: string | null;
  };
  editable: boolean;
}) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const tree = useTree();
  const found = task.folder_id ? findFolder(tree.data, task.folder_id) : undefined;
  // O projeto (a raiz): o material de qualquer subpasta dele vale
  const root = found?.parent ?? (found && 'children' in found.folder ? found.folder : undefined);
  const folderIds = root ? [root.id, ...root.children.map((c) => c.id)] : [];
  const all = useProjectMaterials(folderIds);
  const links = useMaterialLinks(root?.id, !!root && (all.data?.length ?? 0) > 0);
  const pageTasks = usePageTasks(task.page_id ?? undefined);
  const { link, unlink } = useMaterialLinkMutations();
  const [picking, setPicking] = useState(false);
  const toast = useToast();
  const onError = (err: Error) => toast({ message: err.message });

  if (!root || !all.data?.length) return null;
  // As tarefas mães, da mais próxima para a mais distante (a sessão herda da miniatura)
  const byId = new Map((pageTasks.data ?? []).map((x) => [x.id, x]));
  const ancestors: string[] = [];
  for (
    let p = task.parent_task_id ?? null;
    p && ancestors.length < 10;
    p = byId.get(p)?.parent_task_id ?? null
  )
    ancestors.push(p);
  const items = materialsForTask(links.data ?? [], {
    id: task.id,
    page_id: task.page_id,
    ancestors,
  });
  if (!items.length && !editable) return null;
  const own = new Map(items.filter((m) => m.via === 'task').map((m) => [m.material_id, m]));
  const canEdit = editable && online;

  const hint = (m: TaskMaterial) =>
    m.via === 'parent'
      ? t('materials.viaParent', { title: m.target_title })
      : m.via === 'page'
        ? t('materials.viaPage', { title: m.target_title })
        : m.auto
          ? t('materials.viaCode')
          : t('materials.viaHand');

  return (
    <View testID="task-materials">
      <SectionLabel
        title={t('materials.title')}
        count={items.length || undefined}
        right={
          canEdit ? (
            <Button
              variant="ghost"
              icon={Link2}
              label={t('materials.link')}
              onPress={() => setPicking(true)}
            />
          ) : undefined
        }
      />
      {items.length === 0 && (
        <Text className="px-2 pb-2 text-sm text-ink-muted">{t('materials.noneLinked')}</Text>
      )}
      {items.map((m) => (
        <View
          key={m.material_id}
          className="min-h-11 flex-row items-center hover:bg-wash md:min-h-10"
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={materialTitle(m.material_name)}
            className="flex-1 flex-row items-center gap-3 px-2 py-2"
            onPress={() => openMaterial({ id: m.material_id, note_id: m.note_id })}
          >
            <Icon icon={iconFor(m)} tone="ink-muted" />
            <View className="flex-1">
              <Text className="text-sm text-ink" numberOfLines={2}>
                {materialTitle(m.material_name)}
              </Text>
              <Text className="text-xs text-ink-muted" numberOfLines={1}>
                {hint(m)}
              </Text>
            </View>
          </Pressable>
          {canEdit && m.via === 'task' && (
            <IconButton
              icon={X}
              label={t('materials.unlink', { name: materialTitle(m.material_name) })}
              onPress={() => unlink.mutate({ material: m, taskId: task.id }, { onError })}
            />
          )}
        </View>
      ))}
      {picking && (
        <DialogFrame onClose={() => setPicking(false)} wide>
          <Text className="text-lg font-semibold text-ink">{t('materials.linkTitle')}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {all.data.map((material) => {
              const current = own.get(material.id);
              return (
                <View key={material.id} className="flex-row items-center gap-2 py-1">
                  <Checkbox
                    label={materialTitle(material.name)}
                    checked={!!current}
                    disabled={link.isPending || unlink.isPending}
                    onChange={(checked) =>
                      checked
                        ? link.mutate({ materialId: material.id, taskId: task.id }, { onError })
                        : current &&
                          unlink.mutate({ material: current, taskId: task.id }, { onError })
                    }
                  />
                  <Text className="flex-1 text-sm text-ink" numberOfLines={2}>
                    {materialTitle(material.name)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          <View className="flex-row justify-end">
            <Button label={t('common.close')} onPress={() => setPicking(false)} />
          </View>
        </DialogFrame>
      )}
    </View>
  );
}
