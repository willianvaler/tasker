import { Pencil, RotateCcw } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  getShortcutOverrides,
  resetShortcutOverrides,
  setShortcutOverride,
  subscribeShortcutOverrides,
} from '@/lib/prefs';
import {
  comboFromEvent,
  effectiveCombos,
  formatCombo,
  SHORTCUTS,
  shortcutConflicts,
  type ShortcutScope,
} from '@/lib/shortcuts';
import { isMac, setShortcutRecording } from '@/lib/use-shortcut';

const SCOPES: ShortcutScope[] = ['global', 'list', 'editor', 'capture', 'menu', 'workout'];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const label = (combo: string) =>
  combo
    .split(' ')
    .map((step) => formatCombo(step, isMac))
    .join(' → ');

export function useShortcutOverrides() {
  return useSyncExternalStore(subscribeShortcutOverrides, getShortcutOverrides);
}

/**
 * Tabela de atalhos da Ajuda (sai do registro, lib/shortcuts.ts). Na web cada linha pode ganhar
 * outra tecla (C6): o lápis grava a próxima combinação apertada; Esc cancela. A troca fica no
 * aparelho e vale na hora.
 */
export function ShortcutTable({ query }: { query: string }) {
  const { t } = useTranslation();
  const overrides = useShortcutOverrides();
  const [recording, setRecording] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ id: string; text: string } | null>(null);
  const canEdit = Platform.OS === 'web';
  const q = fold(query.trim());

  useEffect(() => {
    if (!recording) return;
    setShortcutRecording(true);
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(event, isMac);
      if (!combo) return;
      const clash = shortcutConflicts(recording, combo, getShortcutOverrides());
      if (clash.length > 0) {
        setProblem({
          id: recording,
          text: t('help.remapConflict', {
            keys: label(combo),
            other: t(clash[0].description as 'shortcuts.helpOpen'),
          }),
        });
        return;
      }
      setProblem(null);
      setShortcutOverride(recording, combo);
      setRecording(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      setShortcutRecording(false);
    };
  }, [recording, t]);

  const rows = SHORTCUTS.map((s) => ({
    ...s,
    text: t(s.description as 'shortcuts.helpOpen'),
    custom: !!overrides[s.id],
    keys: effectiveCombos(s.id, overrides).map(label),
  })).filter((s) => !q || fold(s.text).includes(q) || s.keys.some((k) => fold(k).includes(q)));

  return (
    <View>
      {SCOPES.map((scope) => {
        const list = rows.filter((r) => r.scope === scope);
        if (list.length === 0) return null;
        return (
          <View key={scope} accessibilityRole="list">
            <Text className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t(`help.scope_${scope}`)}
            </Text>
            {list.map((row) => (
              <View key={row.id} className="border-b border-line">
                <View
                  accessibilityRole="text"
                  accessibilityLabel={`${row.text}: ${row.keys.join(', ')}`}
                  className="min-h-10 flex-row items-center gap-4 py-1"
                >
                  <Text className="flex-1 text-sm text-ink">{row.text}</Text>
                  {recording === row.id ? (
                    <Text className="font-mono text-xs text-accent">{t('help.remapPress')}</Text>
                  ) : (
                    <View className="flex-row flex-wrap justify-end gap-1">
                      {row.keys.map((key) => (
                        <Text
                          key={key}
                          className={
                            row.custom
                              ? 'rounded border border-accent px-1 font-mono text-xs text-ink'
                              : 'rounded border border-line px-1 font-mono text-xs text-ink-muted'
                          }
                        >
                          {key}
                        </Text>
                      ))}
                    </View>
                  )}
                  {canEdit && (
                    <View className="flex-row">
                      <IconButton
                        icon={Pencil}
                        label={t('help.remap', { name: row.text })}
                        onPress={() => {
                          setProblem(null);
                          setRecording(recording === row.id ? null : row.id);
                        }}
                      />
                      {row.custom && (
                        <IconButton
                          icon={RotateCcw}
                          label={t('help.remapReset', { name: row.text })}
                          onPress={() => setShortcutOverride(row.id, null)}
                        />
                      )}
                    </View>
                  )}
                </View>
                {problem?.id === row.id && (
                  <Text className="pb-2 text-xs text-danger">{problem.text}</Text>
                )}
              </View>
            ))}
          </View>
        );
      })}
      {rows.length === 0 && <Text className="text-sm text-ink-muted">{t('help.none')}</Text>}
      {canEdit && Object.keys(overrides).length > 0 && (
        <Button
          variant="ghost"
          className="mt-4 self-start"
          label={t('help.remapResetAll')}
          onPress={resetShortcutOverrides}
        />
      )}
    </View>
  );
}
