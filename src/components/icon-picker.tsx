import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View, type TextInput } from 'react-native';

import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { iconValue, isEmoji, searchIcons } from '@/lib/icon-names';
import { ICON_GLYPHS } from '@/lib/icons';
import { getRecentIcons, pushRecentIcon } from '@/lib/prefs';
import { MARKER_COLORS } from '@/lib/tokens';

/**
 * Seletor de ícone (V2 §8.1): busca por nome em pt/en/es, recentes no topo, emoji (digite ou cole
 * um na busca) e, para pastas e projetos, a cor do marcador. `null` volta ao ícone do tipo.
 */
export function IconPicker({
  value,
  kind,
  onChange,
  color,
  onColor,
  autoFocus,
}: {
  value: string | null;
  kind: ItemKind;
  onChange: (value: string | null) => void;
  color?: string | null;
  onColor?: (color: string | null) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [recent] = useState(getRecentIcons);
  const results = searchIcons(query);
  const searchRef = useRef<TextInput>(null);
  // Dentro de um Modal (popover), a web põe o foco no próprio Modal ao abrir, por cima do
  // autoFocus do campo: o foco vai para a busca logo depois
  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [autoFocus]);
  const typedEmoji = isEmoji(query) ? query.trim() : null;

  function choose(next: string | null) {
    if (next) pushRecentIcon(next);
    onChange(next);
  }

  const cell = (id: string | null, selected: boolean, onPress: () => void, label: string) => (
    <Pressable
      key={id ?? 'default'}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded md:h-8 md:w-8',
        selected ? 'bg-accent-soft' : 'hover:bg-wash active:bg-wash',
      )}
    >
      {id === null ? (
        <ItemIcon kind={kind} tone={selected ? 'accent' : 'ink-muted'} />
      ) : id.startsWith('lucide:') ? (
        <Icon icon={ICON_GLYPHS[id.slice(7)]} tone={selected ? 'accent' : 'ink'} />
      ) : (
        <Text className="text-base">{id}</Text>
      )}
    </Pressable>
  );

  return (
    <View className="gap-3">
      <Input
        ref={searchRef}
        value={query}
        onChangeText={setQuery}
        autoFocus={autoFocus}
        autoCapitalize="none"
        placeholder={t('iconPicker.search')}
        accessibilityLabel={t('iconPicker.search')}
      />
      {recent.length > 0 && !query && (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('iconPicker.recent')}
          </Text>
          <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup">
            {recent.map((id) =>
              cell(id, value === id, () => choose(id), id.startsWith('lucide:') ? id.slice(7) : id),
            )}
          </View>
        </View>
      )}
      <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup">
          {!query && cell(null, !value, () => choose(null), t('iconPicker.default'))}
          {typedEmoji &&
            cell(typedEmoji, value === typedEmoji, () => choose(typedEmoji), typedEmoji)}
          {results.map((id) =>
            cell(iconValue(id), value === iconValue(id), () => choose(iconValue(id)), id),
          )}
        </View>
        {results.length === 0 && !typedEmoji && (
          <Text className="py-2 text-sm text-ink-muted">{t('iconPicker.none')}</Text>
        )}
      </ScrollView>
      {onColor && (
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('iconPicker.color')}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="radiogroup">
            <Pressable
              accessibilityRole="radio"
              aria-checked={!color}
              accessibilityLabel={t('iconPicker.noColor')}
              onPress={() => onColor(null)}
              className={cn(
                'h-8 w-8 items-center justify-center rounded border',
                !color ? 'border-accent' : 'border-line',
              )}
            >
              <Icon icon={X} tone="ink-muted" />
            </Pressable>
            {MARKER_COLORS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                aria-checked={color === c}
                accessibilityLabel={c}
                onPress={() => onColor(c)}
                className={cn(
                  'h-8 w-8 items-center justify-center rounded border',
                  color === c ? 'border-accent' : 'border-transparent',
                )}
              >
                <View className="h-5 w-5 rounded-full" style={{ backgroundColor: c }} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
