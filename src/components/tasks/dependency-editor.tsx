import { router } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type TextInput } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { ActionMenu, useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { nameKey } from '@/lib/members';
import { actorCan } from '@/lib/permissions';
import {
  useDependencyMutations,
  useOutsideTaskOptions,
  useProjectTaskOptions,
  type Dependency,
  type TaskOption,
} from '@/lib/queries/dependencies';
import { rootFolder, useFolderActor } from '@/lib/queries/projects';
import { useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

const LAGS = [0, 15, 30, 60] as const;

/** "Depende de" (editável) e "Libera" (só leitura) no painel da tarefa (V3 §2.5). */
export function DependencyEditor({
  task,
  dependsOn,
  unlocks,
  titleOf,
  canOpen = () => true,
  inputRef,
}: {
  task: Task;
  dependsOn: Dependency[];
  /** De quem depende desta; as de outro projeto (PC2) vêm com `outside` */
  unlocks: { id: string; task_id: string; outside?: true }[];
  titleOf: (id: string) => string | undefined;
  /** Tarefa de outro projeto em que a pessoa não está não abre */
  canOpen?: (id: string) => boolean;
  inputRef?: RefObject<TextInput | null>;
}) {
  const { t } = useTranslation();
  const tree = useTree();
  const root = rootFolder(tree.data, task.folder_id);
  const actor = useFolderActor(task.folder_id);
  const canLink = actorCan(actor, 'dependency.manage');
  const [query, setQuery] = useState('');
  const options = useProjectTaskOptions(root?.id, canLink && query.length > 0);
  // Outros projetos (PC2, D307): depois das daqui, com o nome do projeto
  const outside = useOutsideTaskOptions(canLink ? root?.id : undefined, query);
  const m = useDependencyMutations(root?.id);
  const update = useUpdateTask();
  const toast = useToast();
  const [menu, setMenu, closeMenu] = useDialog<Dependency>();
  const onError = (err: Error) => toast({ message: err.message });

  const linked = new Set(dependsOn.map((d) => d.depends_on_task_id));
  const key = nameKey(query);
  const matches = key
    ? (options.data ?? [])
        .filter((o) => o.id !== task.id && !linked.has(o.id) && nameKey(o.title).includes(key))
        .slice(0, 6)
    : [];
  const outsideMatches = key
    ? (outside.data ?? [])
        .filter((o) => !linked.has(o.id) && nameKey(o.title).includes(key))
        .slice(0, Math.max(0, 8 - matches.length))
    : [];
  const choices: (TaskOption & { project?: string })[] = [...matches, ...outsideMatches];
  const title = (id: string) => titleOf(id) ?? options.data?.find((o) => o.id === id)?.title ?? '…';

  function link(option: TaskOption) {
    m.add.mutate({ taskId: task.id, dependsOn: option.id }, { onError });
    setQuery('');
  }

  if (!root || (!canLink && dependsOn.length === 0 && unlocks.length === 0)) return null;

  return (
    <View className="gap-3">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('flow.dependsOn')}
        </Text>
        {dependsOn.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {dependsOn.map((d) => (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                accessibilityLabel={t('flow.prereqOptions', { title: title(d.depends_on_task_id) })}
                disabled={!canLink}
                onPress={() => setMenu(d)}
                className="min-h-9 flex-row items-center gap-1 rounded bg-wash px-2 hover:bg-line"
              >
                <Icon icon={Link2} size={16} tone="ink-muted" />
                <Text className="text-sm text-ink">{title(d.depends_on_task_id)}</Text>
                {d.lag_minutes > 0 && (
                  <Text className="font-mono text-xs text-ink-muted">
                    {t('flow.lagShort', { minutes: d.lag_minutes })}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
        {dependsOn.length > 1 && canLink && (
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {(['all', 'any'] as const).map((mode) => (
              <Chip
                key={mode}
                role="radio"
                label={t(mode === 'all' ? 'flow.modeAll' : 'flow.modeAny')}
                selected={task.deps_mode === mode}
                onPress={() =>
                  update.mutate({ id: task.id, patch: { deps_mode: mode } }, { onError })
                }
              />
            ))}
          </View>
        )}
        {canLink && (
          <Input
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t('flow.searchPlaceholder')}
            accessibilityLabel={t('flow.dependsOn')}
            onSubmitEditing={() => choices[0] && link(choices[0])}
          />
        )}
        {choices.length > 0 && (
          <View accessibilityRole="list" className="border-b border-line">
            {choices.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={t('flow.linkTo', {
                  title: option.project
                    ? t('flow.outsideTitle', { title: option.title, project: option.project })
                    : option.title,
                })}
                onPress={() => link(option)}
                className="min-h-10 flex-row items-center gap-2 px-2 hover:bg-wash"
              >
                <Text className="flex-1 text-sm text-ink">{option.title}</Text>
                {option.project && (
                  <Text className="text-xs text-ink-muted" numberOfLines={1}>
                    {option.project}
                  </Text>
                )}
                {option.status === 'done' && (
                  <Text className="font-mono text-xs text-ink-muted">{t('flow.isDone')}</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {unlocks.length > 0 && (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('flow.unlocks')}
          </Text>
          {unlocks.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="link"
              disabled={!canOpen(d.task_id)}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: d.task_id } })}
              className="min-h-9 flex-row items-center gap-2 rounded px-1 hover:bg-wash"
            >
              <Icon icon={Link2} size={16} tone="ink-muted" />
              <Text className="text-sm text-ink">{title(d.task_id)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {menu && (
        <ActionMenu
          title={title(menu.depends_on_task_id)}
          onClose={closeMenu}
          actions={[
            ...LAGS.map((lag) => ({
              label: lag ? t('flow.lagOption', { minutes: lag }) : t('flow.noLag'),
              onPress: () => m.setLag.mutate({ id: menu.id, lag }, { onError }),
            })),
            {
              label: t('flow.unlink'),
              destructive: true,
              onPress: () => m.remove.mutate(menu.id, { onError }),
            },
          ]}
        />
      )}
    </View>
  );
}
