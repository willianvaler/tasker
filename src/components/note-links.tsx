import { router } from 'expo-router';
import { Link2, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { LINK_ICON } from '@/components/wikilink-autocomplete';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useBacklinks, type Backlink } from '@/lib/queries/links';
import { isSharedWithMe, useNoteMutations, useNotes, type Note } from '@/lib/queries/notes';
import {
  findMention,
  linkMention,
  parseLinks,
  resolveTitleLinks,
  type LinkHref,
  type LinkKind,
  type ResolveLink,
} from '@/lib/wikilinks';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

// Painéis dos links [[...]] (OB1, OB2, D286): "Citado em" (quem aponta para cá, com a frase),
// "Links que saem" e "Menções sem link" (com Ligar).

export function openItem(kind: LinkKind, id: string, anchor?: string | null) {
  if (kind === 'note')
    router.push({ pathname: '/nota/[id]', params: anchor ? { id, secao: anchor } : { id } });
  else if (kind === 'task') router.push({ pathname: '/task/[id]', params: { id } });
  else if (kind === 'page') router.push({ pathname: '/page/[id]', params: { id } });
  else router.push({ pathname: '/folder/[id]', params: { id } });
}

/**
 * Abre o destino de um link. O que ainda não existe ([[Nova ideia]]) abre a anotação com esse
 * título, se houver, ou cria uma (na mesma pasta da origem); a origem ganha o id no link, para o
 * "Citado em" achar e renomear não quebrar.
 */
export function useOpenLink(source?: {
  folderId: string | null;
  body: string;
  setBody: (body: string) => void;
}) {
  const notes = useNotes();
  const m = useNoteMutations();
  const toast = useToast();
  return (href: LinkHref) => {
    if (href.kind === 'none') return;
    if (href.kind !== 'new') return openItem(href.kind, href.id, href.anchor);
    const key = href.title.trim().toLocaleLowerCase();
    const existing = notes.data?.find((n) => n.title.trim().toLocaleLowerCase() === key);
    const link = (id: string) => {
      if (source) source.setBody(resolveTitleLinks(source.body, href.title, 'note', id));
      openItem('note', id, href.anchor);
    };
    if (existing) return link(existing.id);
    m.create
      .mutateAsync({ folderId: source?.folderId ?? null, title: href.title })
      .then(link)
      .catch((err: Error) => toast({ message: err.message }));
  };
}

function LinkRow({
  icon,
  title,
  context,
  onPress,
  muted,
  right,
}: {
  icon: typeof Link2;
  title: string;
  context?: string;
  onPress?: () => void;
  muted?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        className="min-h-10 flex-1 flex-row items-start gap-2 rounded px-1 py-2 hover:bg-wash"
      >
        <View className="mt-1">
          <Icon icon={icon} size={16} tone="ink-muted" />
        </View>
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className={muted ? 'text-sm italic text-ink-muted' : 'text-sm text-ink'}
          >
            {title}
          </Text>
          {!!context && (
            <Text numberOfLines={2} className="text-xs text-ink-muted">
              {context}
            </Text>
          )}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

/** "Citado em": quem tem um [[link]] para este item. `hideEmpty`: sem nenhum, não mostra nada */
export function Backlinks({
  kind,
  id,
  hideEmpty,
  bare,
}: {
  kind: LinkKind;
  id: string;
  hideEmpty?: boolean;
  /** Sem o rótulo de seção (quem chama já tem um) */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const { list } = useBacklinks(kind, id);
  if (hideEmpty && !list.length) return null;
  return (
    <View accessibilityRole="list" aria-label={t('wikilinks.backlinks')}>
      {!bare && <SectionLabel title={t('wikilinks.backlinks')} count={list.length || undefined} />}
      {list.length ? (
        list.map((b: Backlink) => (
          <LinkRow
            key={b.sourceId}
            icon={LINK_ICON[b.sourceKind]}
            title={b.title || t('notes.untitled')}
            context={b.context}
            onPress={() => openItem(b.sourceKind, b.sourceId)}
          />
        ))
      ) : (
        <Text className="py-2 text-sm text-ink-muted">{t('wikilinks.noBacklinks')}</Text>
      )}
    </View>
  );
}

/** "Links que saem": o que o texto cita, inclusive o que ainda não existe */
export function OutgoingLinks({
  body,
  resolve,
  onOpen,
}: {
  body: string;
  resolve: ResolveLink;
  onOpen: (href: LinkHref) => void;
}) {
  const { t } = useTranslation();
  const seen = new Set<string>();
  const links = parseLinks(body).filter((l) => {
    const key = l.id ?? `new:${l.title.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!links.length) return null;
  return (
    <View accessibilityRole="list" aria-label={t('wikilinks.outgoing')}>
      <SectionLabel title={t('wikilinks.outgoing')} count={links.length} />
      {links.map((l) => {
        if (!l.kind || !l.id)
          return (
            <LinkRow
              key={`new:${l.title}`}
              icon={Plus}
              title={l.title}
              context={t('wikilinks.notYet')}
              muted
              onPress={() => onOpen({ kind: 'new', title: l.title, anchor: l.anchor })}
            />
          );
        const { kind, id } = l;
        const title = resolve(kind, id);
        return (
          <LinkRow
            key={`${kind}:${id}`}
            icon={LINK_ICON[kind]}
            title={title === null ? t('wikilinks.noAccess') : title || l.title}
            muted={title === null}
            onPress={title === null ? undefined : () => onOpen({ kind, id, anchor: l.anchor })}
          />
        );
      })}
    </View>
  );
}

/**
 * "Menções sem link": as minhas anotações (as sem pasta, que só eu escrevo) com o título desta
 * escrito sem [[ ]]. Ligar troca a primeira menção pelo link.
 */
export function UnlinkedMentions({
  note,
  title,
  aliases = [],
}: {
  note: Pick<Note, 'id'>;
  title: string;
  /** Outros nomes da anotação (OB4): também contam como menção */
  aliases?: string[];
}) {
  const { t } = useTranslation();
  const notes = useNotes();
  const m = useNoteMutations();
  const toast = useToast();
  const me = useSession().session?.user.id;
  const names = [title, ...aliases].map((n) => n.trim()).filter((n) => n.length >= 3);
  if (!names.length) return null;
  const hits = (notes.data ?? []).flatMap((n) => {
    if (n.id === note.id || n.folder_id != null || isSharedWithMe(n, me)) return [];
    const name = names.find((x) => findMention(n.body, x) >= 0);
    return name ? [{ note: n, name }] : [];
  });
  if (!hits.length) return null;
  return (
    <View accessibilityRole="list" aria-label={t('wikilinks.unlinked')}>
      <SectionLabel title={t('wikilinks.unlinked')} count={hits.length} />
      {hits.map(({ note: n, name }) => {
        const at = findMention(n.body, name);
        const line = n.body.slice(n.body.lastIndexOf('\n', at) + 1).split('\n')[0];
        return (
          <LinkRow
            key={n.id}
            icon={LINK_ICON.note}
            title={n.title.trim() || t('notes.untitled')}
            context={line.trim().slice(0, 200)}
            onPress={() => openItem('note', n.id)}
            right={
              <Button
                variant="ghost"
                icon={Link2}
                label={t('wikilinks.link')}
                accessibilityLabel={t('wikilinks.linkIn', {
                  title: n.title || t('notes.untitled'),
                })}
                onPress={() =>
                  m.update.mutate(
                    { id: n.id, body: linkMention(n.body, name, 'note', note.id) },
                    { onError: (err: Error) => toast({ message: err.message }) },
                  )
                }
              />
            }
          />
        );
      })}
    </View>
  );
}

/** "Citado em" curto, numa linha de chips (no alto da lista); sem nenhum, nada */
export function BacklinkChips({ kind, id }: { kind: LinkKind; id: string }) {
  const { t } = useTranslation();
  const { list } = useBacklinks(kind, id);
  if (!list.length) return null;
  return (
    <View
      className="flex-row flex-wrap items-center gap-2 pb-3"
      accessibilityRole="list"
      aria-label={t('wikilinks.backlinks')}
    >
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t('wikilinks.backlinks')}
      </Text>
      {list.map((b) => (
        <Pressable
          key={b.sourceId}
          accessibilityRole="link"
          accessibilityHint={b.context}
          onPress={() => openItem(b.sourceKind, b.sourceId)}
          className="min-h-8 max-w-full flex-row items-center gap-1 rounded bg-wash px-2 hover:bg-line"
        >
          <Icon icon={LINK_ICON[b.sourceKind]} size={16} tone="ink-muted" />
          <Text numberOfLines={1} className="shrink text-sm text-ink">
            {b.title || t('notes.untitled')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
