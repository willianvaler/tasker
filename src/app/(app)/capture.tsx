import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { QuickAdd } from '@/components/tasks/quick-add';
import { Text } from '@/components/ui/text';
import { captureTargetId, folderScope } from '@/lib/capture-target';
import { cn } from '@/lib/cn';
import { getLastPageId } from '@/lib/prefs';
import { useShortcut } from '@/lib/use-shortcut';
import { folderLabel } from '@/components/folder-cards';
import { pageLabel, useTree, type Page } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

// Captura rápida de qualquer tela (atalho N / Ctrl+K na web, botão + no celular).
// Destino padrão: a página ou pasta de onde ela foi aberta (lib/capture-target.ts), senão a Caixa
// de entrada.
export default function CaptureScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ page?: string; folder?: string }>();
  const [chosen, setChosen] = useState<string | null>(null);

  // Destinos agrupados por pasta (as páginas de sistema primeiro, sem pasta)
  const groups = useMemo(() => {
    if (!tree.data) return [];
    const system = [tree.data.inbox, tree.data.habits].filter((p): p is Page => !!p);
    return [
      { label: '', pages: system },
      ...tree.data.folders.flatMap((f) => [
        { label: folderLabel(f), pages: f.pages },
        ...f.children.map((c) => ({
          label: `${folderLabel(f)} › ${folderLabel(c)}`,
          pages: c.pages,
        })),
      ]),
    ].filter((g) => g.pages.length > 0);
  }, [tree.data]);
  const pages = groups.flatMap((g) => g.pages);

  const contextPageId = captureTargetId(
    params,
    pages,
    (id) => folderScope(tree.data?.folders, id),
    getLastPageId(),
  );
  const target =
    pages.find((p) => p.id === chosen) ??
    pages.find((p) => p.id === contextPageId) ??
    tree.data?.inbox ??
    undefined;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useShortcut('capture.close', close);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 justify-start bg-scrim/40"
    >
      <Pressable
        accessibilityLabel={t('common.close')}
        className="absolute inset-0"
        onPress={close}
      />
      <View
        className="mx-auto w-full max-w-xl gap-4 rounded-b-lg border border-t-0 border-line bg-surface p-4 md:mt-12 md:rounded-lg md:border-t"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t('capture.title')}
        </Text>
        <QuickAdd
          pageId={target?.id}
          autoFocus
          onCreated={() =>
            target && toast({ message: t('capture.created', { page: pageLabel(target) }) })
          }
        />
        {/* Grupos com quebra de linha (sem rolagem lateral), rolando na vertical se forem muitos */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 280 }}
          contentContainerClassName="gap-3"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('capture.where')}
        >
          {groups.map((group) => (
            <View key={group.label || 'sistema'} className="gap-1">
              {group.label ? (
                <Text className="font-mono text-xs uppercase text-ink-muted">{group.label}</Text>
              ) : null}
              <View className="flex-row flex-wrap gap-2">
                {group.pages.map((page) => (
                  <Pressable
                    key={page.id}
                    accessibilityRole="radio"
                    aria-checked={page.id === target?.id}
                    onPress={() => setChosen(page.id)}
                    className={cn(
                      'min-h-11 flex-row items-center gap-2 rounded px-2 md:min-h-8',
                      page.id === target?.id ? 'bg-accent-soft' : 'bg-wash hover:bg-line',
                    )}
                  >
                    <ItemIcon
                      icon={page.is_inbox || page.is_habits ? null : page.icon}
                      kind={page.is_inbox ? 'inbox' : (page.view_type as ItemKind)}
                      tone={page.id === target?.id ? 'accent' : 'ink-muted'}
                    />
                    <Text
                      className={cn(
                        'text-sm',
                        page.id === target?.id ? 'font-semibold text-accent' : 'text-ink',
                      )}
                    >
                      {pageLabel(page)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <Text className="font-mono text-xs text-ink-muted">{t('capture.help')}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}
