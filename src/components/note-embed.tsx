import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ExternalLink, FileText, Folder, ListChecks, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { NoteMarkdown } from '@/components/note-markdown';
import { TaskRow } from '@/components/tasks/task-row';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { embedTarget, MAX_EMBED_DEPTH, noteSection } from '@/lib/note-embeds';
import { useAttachmentByName, useSignedUrls } from '@/lib/queries/attachments';
import { noteTitle, useNotes } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { usePageTasks, useTask } from '@/lib/queries/tasks';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import type { LinkHref, ResolveLink, WikiLink } from '@/lib/wikilinks';

/** Quantas tarefas de uma lista incorporada aparecem (o resto, "Abrir a lista") */
const PAGE_ROWS = 15;

/**
 * Um ![[...]] (OB6, D291): outra anotação (ou o trecho de um título), uma lista com as caixinhas de
 * verdade (concluir aqui é concluir lá), uma tarefa, uma pasta ou uma imagem dos anexos pelo nome.
 */
export function NoteEmbed({
  link,
  depth,
  onLink,
  resolve,
}: {
  link: WikiLink;
  depth: number;
  onLink?: (href: LinkHref) => void;
  resolve?: ResolveLink;
}) {
  const target = embedTarget(link);
  switch (target.kind) {
    case 'note':
      return (
        <EmbeddedNote id={target.id} link={link} depth={depth} onLink={onLink} resolve={resolve} />
      );
    case 'page':
      return <EmbeddedPage id={target.id} />;
    case 'task':
      return <EmbeddedTask id={target.id} />;
    case 'folder':
      return <EmbeddedFolder id={target.id} title={link.title} />;
    case 'image':
      return <EmbeddedImage name={target.name} alt={link.alias} />;
    case 'missing':
      return <Missing title={link.title} onLink={onLink} />;
  }
}

function Frame({
  icon,
  title,
  onOpen,
  testID,
  children,
}: {
  icon: LucideIcon;
  title: string;
  onOpen?: () => void;
  testID: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View testID={testID} className="my-1 overflow-hidden rounded-lg border border-line">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('embeds.open', { title })}
        disabled={!onOpen}
        onPress={onOpen}
        className="min-h-9 flex-row items-center gap-2 border-b border-line bg-wash px-3 py-1 hover:bg-line"
      >
        <Icon icon={icon} size={16} tone="ink-muted" />
        <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-ink">
          {title}
        </Text>
        {onOpen && <Icon icon={ExternalLink} size={16} tone="ink-muted" />}
      </Pressable>
      {children}
    </View>
  );
}

function NoAccess() {
  const { t } = useTranslation();
  return (
    <View className="my-1 rounded-lg border border-dashed border-line px-3 py-2">
      <Text className="text-sm italic text-ink-muted">{t('wikilinks.noAccess')}</Text>
    </View>
  );
}

function EmbeddedNote({
  id,
  link,
  depth,
  onLink,
  resolve,
}: {
  id: string;
  link: WikiLink;
  depth: number;
  onLink?: (href: LinkHref) => void;
  resolve?: ResolveLink;
}) {
  const { t } = useTranslation();
  const notes = useNotes({ templates: 'include' });
  const note = notes.data?.find((n) => n.id === id);
  if (!notes.data) return null;
  if (!note) return <NoAccess />;
  const title = noteTitle(note, t('notes.untitled'));
  const open = () =>
    router.push({
      pathname: '/nota/[id]',
      params: link.anchor ? { id, secao: link.anchor } : { id },
    });
  const body = noteSection(note.body, link.anchor);
  return (
    <Frame
      icon={FileText}
      title={link.anchor ? `${title} › ${link.anchor}` : title}
      onOpen={open}
      testID="embed-note"
    >
      <View className="px-3 py-1">
        {depth >= MAX_EMBED_DEPTH ? (
          // Fundo demais (ou volta para a mesma): fica o link
          <Text className="py-1 text-sm text-ink-muted">{t('embeds.tooDeep')}</Text>
        ) : body.trim() ? (
          <NoteMarkdown value={body} onLink={onLink} resolve={resolve} depth={depth + 1} />
        ) : (
          <Text className="py-1 text-sm text-ink-muted">{t('embeds.empty')}</Text>
        )}
      </View>
    </Frame>
  );
}

function EmbeddedPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const today = useToday();
  const tree = useTree();
  const tasks = usePageTasks(id);
  const page = tree.data?.pages.find((p) => p.id === id);
  if (!tree.data || !tasks.data) return null;
  if (!page) return <NoAccess />;
  const top = tasks.data.filter((task) => !task.parent_task_id);
  // As abertas primeiro, como na lista
  const ordered = [
    ...top.filter((task) => task.status !== 'done'),
    ...top.filter((task) => task.status === 'done'),
  ];
  return (
    <Frame
      icon={ListChecks}
      title={pageLabel(page)}
      onOpen={() => router.push({ pathname: '/page/[id]', params: { id } })}
      testID="embed-page"
    >
      {ordered.length === 0 && (
        <Text className="px-3 py-2 text-sm text-ink-muted">{t('embeds.emptyList')}</Text>
      )}
      {ordered.slice(0, PAGE_ROWS).map((task) => (
        <TaskRow key={task.id} task={task} today={today} />
      ))}
      {ordered.length > PAGE_ROWS && (
        <Text className="px-3 py-2 text-xs text-ink-muted">
          {t('embeds.more', { count: ordered.length - PAGE_ROWS })}
        </Text>
      )}
    </Frame>
  );
}

function EmbeddedTask({ id }: { id: string }) {
  const today = useToday();
  const task = useTask(id);
  if (task.isPending) return null;
  if (!task.data) return <NoAccess />;
  return (
    <View testID="embed-task" className="my-1 overflow-hidden rounded-lg border border-line">
      <TaskRow task={task.data} today={today} />
    </View>
  );
}

function EmbeddedFolder({ id, title }: { id: string; title: string }) {
  const tree = useTree();
  const folder = findFolder(tree.data, id)?.folder;
  if (!tree.data) return null;
  if (!folder) return <NoAccess />;
  return (
    <Frame
      icon={Folder}
      title={folder.name || title}
      onOpen={() => router.push({ pathname: '/folder/[id]', params: { id } })}
      testID="embed-folder"
    />
  );
}

function EmbeddedImage({ name, alt }: { name: string; alt: string | null }) {
  const { t } = useTranslation();
  const found = useAttachmentByName(name);
  const attachment = found.data;
  const urls = useSignedUrls(attachment ? [attachment.path] : []);
  if (found.isPending) return null;
  if (!attachment)
    return (
      <View className="my-1 rounded-lg border border-dashed border-line px-3 py-2">
        <Text className="text-sm text-ink-muted">{t('embeds.noImage', { name })}</Text>
      </View>
    );
  const uri = urls.data?.[attachment.path];
  const ratio =
    attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;
  return (
    <View
      testID="embed-image"
      className="my-1 w-full overflow-hidden rounded-lg bg-wash"
      style={{ aspectRatio: ratio, maxHeight: 480 }}
    >
      {uri && (
        <Image
          source={{ uri, cacheKey: attachment.path }}
          placeholder={attachment.thumb_path ? { cacheKey: attachment.thumb_path } : undefined}
          contentFit="contain"
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={alt ?? attachment.name}
        />
      )}
    </View>
  );
}

function Missing({ title, onLink }: { title: string; onLink?: (href: LinkHref) => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('embeds.create', { title })}
      onPress={() => onLink?.({ kind: 'new', title, anchor: null })}
      className="my-1 rounded-lg border border-dashed border-line px-3 py-2 hover:bg-wash"
    >
      <Text className="text-sm text-ink-muted">{t('embeds.create', { title })}</Text>
    </Pressable>
  );
}
