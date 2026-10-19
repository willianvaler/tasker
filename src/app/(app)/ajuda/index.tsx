import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Markdown } from '@/components/markdown';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { HELP } from '@/content/help';
import { formatCombo, SHORTCUTS, type ShortcutScope } from '@/lib/shortcuts';

const isMac =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

const SCOPES: ShortcutScope[] = ['global', 'list', 'editor', 'capture', 'menu', 'workout'];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Ajuda: os artigos (content/help, F1/D145) e a tabela de atalhos, que sai do registro
 * (lib/shortcuts.ts) e nunca é escrita à mão. A busca vale para os dois. Cada artigo abre o texto
 * logo abaixo do título (D188), sem trocar de tela; o "?" das telas chega com ?artigo=<slug>.
 */
export default function HelpScreen() {
  const { t, i18n } = useTranslation();
  const { artigo } = useLocalSearchParams<{ artigo?: string }>();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string[]>(artigo ? [artigo] : []);
  // Veio do "?" de uma tela: rola até o artigo aberto (uma vez)
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);
  const articlesTop = useRef(0);
  const toggle = (slug: string) =>
    setOpen((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
  const articles = (HELP[i18n.language] ?? HELP['pt-BR']).filter(
    (a) => !query.trim() || fold(`${a.title} ${a.body}`).includes(fold(query.trim())),
  );
  const q = fold(query.trim());

  const rows = SHORTCUTS.map((s) => ({
    ...s,
    text: t(s.description as 'shortcuts.helpOpen'),
    keys: s.combos.map((combo) =>
      combo
        .split(' ')
        .map((step) => formatCombo(step, isMac))
        .join(' → '),
    ),
  })).filter((s) => !q || fold(s.text).includes(q) || s.keys.some((k) => fold(k).includes(q)));

  return (
    <Screen size="medium">
      <ScreenHeader title={t('help.title')} back />
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 pb-12"
      >
        <Text className="text-base text-ink">{t('help.intro')}</Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            label={t('help.tour')}
            onPress={() => router.push('/onboarding')}
          />
          <Text className="text-xs text-ink-muted">{t('help.tourHint')}</Text>
        </View>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('help.search')}
          accessibilityLabel={t('help.search')}
        />
        <SectionLabel title={t('help.articles')} />
        <View
          className="gap-2"
          onLayout={(e) => {
            articlesTop.current = e.nativeEvent.layout.y;
          }}
        >
          {articles.map((a) => {
            const expanded = open.includes(a.slug);
            return (
              <View
                key={a.slug}
                className="rounded border border-line bg-surface"
                onLayout={(e) => {
                  if (a.slug !== artigo || scrolled.current) return;
                  scrolled.current = true;
                  scroll.current?.scrollTo({
                    y: articlesTop.current + e.nativeEvent.layout.y - 8,
                    animated: false,
                  });
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  aria-expanded={expanded}
                  onPress={() => toggle(a.slug)}
                  className="min-h-12 flex-row items-center gap-3 rounded px-3 hover:bg-wash active:bg-wash"
                >
                  <Icon icon={expanded ? ChevronDown : ChevronRight} tone="ink-muted" />
                  <Text className="flex-1 text-base font-semibold text-ink">{a.title}</Text>
                </Pressable>
                {expanded && (
                  <View className="gap-4 border-t border-line px-4 pb-4 pt-2">
                    <Markdown source={a.body} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <SectionLabel title={t('help.shortcuts')} className="pt-4" />
        {SCOPES.map((scope) => {
          const list = rows.filter((r) => r.scope === scope);
          if (list.length === 0) return null;
          return (
            <View key={scope} accessibilityRole="list">
              <Text className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t(`help.scope_${scope}`)}
              </Text>
              {list.map((row) => (
                <View
                  key={row.id}
                  accessibilityRole="text"
                  accessibilityLabel={`${row.text}: ${row.keys.join(', ')}`}
                  className="min-h-10 flex-row items-center gap-4 border-b border-line py-1"
                >
                  <Text className="flex-1 text-sm text-ink">{row.text}</Text>
                  <View className="flex-row flex-wrap justify-end gap-1">
                    {row.keys.map((key) => (
                      <Text
                        key={key}
                        className="rounded border border-line px-1 font-mono text-xs text-ink-muted"
                      >
                        {key}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        {rows.length === 0 && <Text className="text-sm text-ink-muted">{t('help.none')}</Text>}
        <Text className="pt-4 text-xs text-ink-muted">{t('help.typingNote')}</Text>
        <Text className="text-xs text-ink-muted">{t('help.browserNote')}</Text>
      </ScrollView>
    </Screen>
  );
}
