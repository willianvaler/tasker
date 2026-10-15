import { router } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  useRelationCandidates,
  useRelationMutations,
  useRelations,
  type ItemType,
} from '@/lib/queries/relations';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

function open(type: ItemType, id: string) {
  if (type === 'task') router.push({ pathname: '/task/[id]', params: { id } });
  else if (type === 'page') router.push({ pathname: '/page/[id]', params: { id } });
  else router.push({ pathname: '/folder/[id]', params: { id } });
}

/**
 * "Relacionados" (V3 §2.4): chips com os itens ligados a este, nos dois sentidos. Não mexe em
 * estado nem em permissão. O item a que o usuário não tem acesso aparece sem título.
 * `editable`: pode ligar (editar o item); desligar segue o que o servidor diz em cada vínculo.
 */
export function Related({
  type,
  id,
  editable,
  hideEmpty,
  startSearching = false,
}: {
  type: ItemType;
  id: string;
  editable: boolean;
  /** Sem vínculos e sem poder ligar: não mostra nada */
  hideEmpty?: boolean;
  /** Abre já na busca (ex.: "Relacionar com…" no menu da lista) */
  startSearching?: boolean;
}) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const relations = useRelations(type, id);
  const m = useRelationMutations(type, id);
  const [searching, setSearching] = useState(startSearching);
  const [query, setQuery] = useState('');
  const candidates = useRelationCandidates(searching ? query : '');
  const list = relations.data ?? [];
  const canAdd = editable && online;
  if (hideEmpty && !list.length && !searching) return null;
  const linked = new Set(list.map((r) => `${r.other_type}:${r.other_id}`));
  const onError = (err: Error) => toast({ message: err.message });

  return (
    <View className="gap-2">
      <View
        className="flex-row flex-wrap items-center gap-2"
        accessibilityRole="list"
        aria-label={t('related.title')}
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('related.title')}
        </Text>
        {list.map((r) => (
          <View key={r.id} className="max-w-full flex-row items-center rounded bg-wash">
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={
                r.title
                  ? t('related.open', { title: r.title, kind: t(`related.kind_${r.other_type}`) })
                  : t('related.restricted')
              }
              disabled={!r.title}
              onPress={() => open(r.other_type, r.other_id)}
              className="min-h-8 shrink justify-center px-2 hover:bg-line"
            >
              {/* Título longo corta com "…": o X de desfazer o vínculo não pode sair da tela */}
              <Text
                numberOfLines={1}
                className={cn('text-sm', r.title ? 'text-ink' : 'italic text-ink-muted')}
              >
                {r.icon && !r.icon.startsWith('lucide:') ? `${r.icon} ` : ''}
                {r.title ?? t('related.restricted')}
              </Text>
            </Pressable>
            {r.can_unlink && online && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('related.unlink', {
                  title: r.title ?? t('related.restricted'),
                })}
                onPress={() => m.remove.mutate(r.id, { onError })}
                className="h-8 w-7 shrink-0 items-center justify-center hover:bg-line"
              >
                <Icon icon={X} size={16} tone="ink-muted" />
              </Pressable>
            )}
          </View>
        ))}
        {!list.length && !canAdd && (
          <Text className="text-sm text-ink-muted">{t('related.none')}</Text>
        )}
        {canAdd && !searching && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSearching(true)}
            className="min-h-8 flex-row items-center gap-1 rounded px-2 hover:bg-wash"
          >
            <Icon icon={Plus} size={16} tone="accent" />
            <Text className="text-sm text-accent">{t('related.add')}</Text>
          </Pressable>
        )}
      </View>
      {searching && (
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Input
                accessibilityLabel={t('related.search')}
                placeholder={t('related.search')}
                value={query}
                onChangeText={setQuery}
                autoFocus
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Escape') setSearching(false);
                }}
              />
            </View>
            <IconButton
              icon={X}
              label={t('common.close')}
              onPress={() => {
                setSearching(false);
                setQuery('');
              }}
            />
          </View>
          {candidates.data
            ?.filter((c) => !(c.type === type && c.id === id) && !linked.has(`${c.type}:${c.id}`))
            .map((c) => (
              <Pressable
                key={`${c.type}:${c.id}`}
                accessibilityRole="button"
                accessibilityLabel={t('related.pick', {
                  title: c.title,
                  kind: t(`related.kind_${c.type}`),
                })}
                onPress={() => {
                  m.add.mutate({ type: c.type, id: c.id }, { onError });
                  setSearching(false);
                  setQuery('');
                }}
                className="min-h-10 flex-row items-center gap-2 rounded px-2 hover:bg-wash md:min-h-8"
              >
                <Text className="w-14 font-mono text-xs text-ink-muted">
                  {t(`related.kind_${c.type}`)}
                </Text>
                <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                  {c.title}
                </Text>
                {c.context && (
                  <Text className="text-xs text-ink-muted" numberOfLines={1}>
                    {c.context}
                  </Text>
                )}
              </Pressable>
            ))}
          {query.trim().length >= 2 && candidates.data?.length === 0 && (
            <Text className="px-2 text-sm text-ink-muted">{t('related.noResults')}</Text>
          )}
        </View>
      )}
    </View>
  );
}
