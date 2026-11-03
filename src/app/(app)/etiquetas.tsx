import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight, Hash } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TaskRow } from '@/components/tasks/task-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { plainText } from '@/lib/markdown-edit';
import { tagMatches, tagTree, type TagNode } from '@/lib/note-props';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { useTaskLabelSets, useTasksWithTag } from '@/lib/queries/tags';
import { pageLabel } from '@/lib/queries/tree';

/**
 * Etiquetas (OB4, D289): as das anotações (`#etiqueta` e a propriedade tags) e as das tarefas,
 * numa árvore (as aninhadas, `treino/perna`, ficam dentro da mãe). Tocar mostra o que tem a
 * etiqueta; a mãe acha também as filhas.
 */
export default function TagsScreen() {
  const { tag } = useLocalSearchParams<{ tag?: string }>();
  const { t } = useTranslation();
  const notes = useNotes();
  const labelSets = useTaskLabelSets();
  const tree = tagTree([...(notes.data ?? []).map((n) => n.tags ?? []), ...(labelSets.data ?? [])]);
  const selected = tag?.toLowerCase() || null;

  return (
    <Screen size="medium">
      <ScreenScroll contentContainerClassName="gap-4 pb-clear">
        <ScreenHeader title={selected ? `#${selected}` : t('tags.title')} back />
        {selected ? (
          <TagDetail tag={selected} tree={tree} />
        ) : tree.length === 0 ? (
          notes.data && labelSets.data ? (
            <EmptyState title={t('tags.empty')} hint={t('tags.emptyHint')} />
          ) : null
        ) : (
          <View accessibilityRole="list" aria-label={t('tags.title')}>
            {tree.map((node) => (
              <TagBranch key={node.tag} node={node} level={0} />
            ))}
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}

function openTag(tag: string) {
  router.push({ pathname: '/etiquetas', params: { tag } });
}

function TagBranch({ node, level }: { node: TagNode; level: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(level === 0 && node.children.length <= 6);
  return (
    <View>
      <View
        className="min-h-11 flex-row items-center border-b border-line"
        style={{ paddingLeft: level * 20 }}
      >
        {node.children.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            aria-expanded={open}
            accessibilityLabel={t(open ? 'tags.collapse' : 'tags.expand', { tag: node.tag })}
            onPress={() => setOpen(!open)}
            className="h-11 w-8 items-center justify-center"
          >
            <Icon icon={open ? ChevronDown : ChevronRight} size={16} tone="ink-muted" />
          </Pressable>
        ) : (
          <View className="w-8" />
        )}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`#${node.tag}`}
          onPress={() => openTag(node.tag)}
          className="h-11 flex-1 flex-row items-center gap-2 pr-2 hover:bg-wash"
        >
          <Icon icon={Hash} size={16} tone="accent" />
          <Text className="flex-1 text-base text-ink" numberOfLines={1}>
            {node.name}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">{node.count}</Text>
        </Pressable>
      </View>
      {open && node.children.map((c) => <TagBranch key={c.tag} node={c} level={level + 1} />)}
    </View>
  );
}

function findNode(nodes: TagNode[], tag: string): TagNode | undefined {
  for (const n of nodes) {
    if (n.tag === tag) return n;
    if (tag.startsWith(`${n.tag}/`)) return findNode(n.children, tag);
  }
  return undefined;
}

function TagDetail({ tag, tree }: { tag: string; tree: TagNode[] }) {
  const { t } = useTranslation();
  const today = useToday();
  const notes = useNotes();
  const tasks = useTasksWithTag(tag);
  const children = findNode(tree, tag)?.children ?? [];
  const hits = (notes.data ?? []).filter((n) => (n.tags ?? []).some((x) => tagMatches(x, tag)));
  const taskList = tasks.data ?? [];
  return (
    <>
      {children.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {children.map((c) => (
            <Pressable
              key={c.tag}
              accessibilityRole="link"
              accessibilityLabel={`#${c.tag}`}
              onPress={() => openTag(c.tag)}
              className="flex-row items-center gap-1 rounded-full border border-line px-3 py-1 hover:bg-wash"
            >
              <Text className="text-sm text-accent">#{c.name}</Text>
              <Text className="font-mono text-xs text-ink-muted">{c.count}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View accessibilityRole="list" aria-label={t('notes.title')}>
        <SectionLabel title={t('notes.title')} count={hits.length} />
        {hits.length === 0 && notes.data && (
          <Text className="py-2 text-sm text-ink-muted">{t('tags.noNotes')}</Text>
        )}
        {hits.map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/nota/[id]', params: { id: note.id } })}
            className="gap-1 border-b border-line px-2 py-3 hover:bg-wash"
          >
            <Text className="text-base font-semibold text-ink" numberOfLines={1}>
              {noteTitle(note, t('notes.untitled'))}
            </Text>
            {!!note.body.trim() && (
              <Text className="text-sm text-ink-muted" numberOfLines={2}>
                {plainText(note.body)}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
      <View>
        <SectionLabel title={t('tags.tasks')} count={taskList.length} />
        {taskList.length === 0 && tasks.data && (
          <Text className="py-2 text-sm text-ink-muted">{t('tags.noTasks')}</Text>
        )}
        {taskList.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            today={today}
            pageLabel={task.page ? pageLabel(task.page) : undefined}
          />
        ))}
      </View>
    </>
  );
}
