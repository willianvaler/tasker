import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoteMarkdown } from '@/components/note-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { plainText } from '@/lib/markdown-edit';
import { publicBody } from '@/lib/published-note';
import { fetchPublishedNote } from '@/lib/queries/note-shares';
import type { LinkHref, ResolveLink } from '@/lib/wikilinks';

/**
 * Anotação publicada (OB14, D300), FORA do login: qualquer pessoa com o endereço lê, sem editar.
 * Com senha, pede antes; com o conjunto (as anotações citadas), os links entre elas abrem aqui
 * mesmo (`?n=<id>`). O texto é sempre o de agora.
 */
export default function PublishedNoteScreen() {
  const { t, i18n } = useTranslation();
  const { token, n } = useLocalSearchParams<{ token: string; n?: string }>();
  const [typed, setTyped] = useState('');
  // A senha que abriu (fica só nesta tela; navegar pelo conjunto não pede de novo)
  const [password, setPassword] = useState<string | null>(null);
  const result = useQuery({
    queryKey: ['published-note', token, password, n ?? null],
    queryFn: () => fetchPublishedNote(token, password, n ?? null),
    retry: false,
  });
  const data = result.data;

  let content;
  if (result.isPending) {
    content = <Text className="text-sm text-ink-muted">{t('published.loading')}</Text>;
  } else if (result.error) {
    content = (
      <Text className="text-sm text-danger">
        {t('published.error', { message: result.error.message })}
      </Text>
    );
  } else if (!data || data.status === 'missing') {
    content = <Text className="font-serif text-xl text-ink">{t('published.missing')}</Text>;
  } else if (data.status !== 'ok') {
    content = (
      <View className="max-w-sm gap-3">
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">
          {t('published.passwordTitle')}
        </Text>
        {data.status !== 'password' && (
          <Text accessibilityRole="alert" className="text-sm text-danger">
            {t(data.status === 'locked' ? 'published.locked' : 'published.wrong')}
          </Text>
        )}
        <Input
          value={typed}
          onChangeText={setTyped}
          secureTextEntry
          autoFocus
          accessibilityLabel={t('published.password')}
          placeholder={t('published.password')}
          onSubmitEditing={() => typed && setPassword(typed)}
        />
        <Button label={t('published.open')} disabled={!typed} onPress={() => setPassword(typed)} />
      </View>
    );
  } else {
    const ids = new Set(data.notes.map((x) => x.id));
    const titles = new Map(data.notes.map((x) => [x.id, x.title]));
    const resolve: ResolveLink = (kind, id) =>
      kind === 'note' && ids.has(id) ? titles.get(id) || t('notes.untitled') : null;
    const openLink = (href: LinkHref) => {
      if (href.kind === 'note' && ids.has(href.id))
        router.setParams({ n: href.id === data.root ? undefined : href.id });
    };
    const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' });
    const note = data.note;
    content = (
      <View className="gap-6 lg:flex-row lg:items-start">
        <View className="flex-1 gap-3">
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {note.title.trim() || t('notes.untitled')}
          </Text>
          <Text className="text-xs text-ink-muted">
            {[
              data.author ? t('published.by', { name: data.author }) : null,
              t('published.updated', { date: when.format(new Date(note.updated_at)) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <NoteMarkdown
            plain
            value={publicBody(note.body, (id) => ids.has(id))}
            resolve={resolve}
            onLink={openLink}
          />
        </View>
        {data.notes.length > 1 && (
          <View
            role="navigation"
            aria-label={t('published.set')}
            className="gap-1 border-line lg:w-64 lg:border-l lg:pl-4"
          >
            <Text className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('published.set')}
            </Text>
            {data.notes.map((x) => (
              <Pressable
                key={x.id}
                accessibilityRole="link"
                aria-current={x.id === note.id ? 'page' : undefined}
                onPress={() => router.setParams({ n: x.id === data.root ? undefined : x.id })}
                className={cn('rounded px-2 py-1 hover:bg-wash', x.id === note.id && 'bg-wash')}
              >
                <Text className="text-sm text-ink" numberOfLines={1}>
                  {x.title.trim() || plainText(x.body).split('\n')[0] || t('notes.untitled')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }

  const title = data?.status === 'ok' ? data.note.title.trim() || t('notes.untitled') : 'Questlist';
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerClassName="mx-auto w-full max-w-5xl gap-8 px-4 py-8 md:px-8">
        {content}
        <Text className="border-t border-line pt-4 text-xs text-ink-muted">
          {t('published.made')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
