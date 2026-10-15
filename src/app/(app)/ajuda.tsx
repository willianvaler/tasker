import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
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
 * Ajuda. A tabela de atalhos sai do registro (lib/shortcuts.ts): nunca é escrita à mão.
 * Os artigos (começando, pastas e projetos, time, sem internet, gamificação) entram na Fase F.
 */
export default function HelpScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-12">
        <Text className="text-base text-ink">{t('help.intro')}</Text>
        <SectionLabel title={t('help.shortcuts')} className="pt-4" />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('help.search')}
          accessibilityLabel={t('help.search')}
        />
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
