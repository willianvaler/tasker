import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickAdd } from '@/components/tasks/quick-add';
import { cn } from '@/lib/cn';
import { getLastPageId } from '@/lib/prefs';
import { folderLabel } from '@/components/folder-cards';
import { pageLabel, useTree, type Page } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

// Captura rápida de qualquer tela (atalho N / Ctrl+K na web, botão + no celular).
// Destino padrão: a última página usada ou a Caixa de entrada.
export default function CaptureScreen() {
  const tree = useTree();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<string | null>(null);

  // Destinos agrupados por pasta (as páginas de sistema primeiro, sem pasta)
  const groups = useMemo(() => {
    if (!tree.data) return [];
    const system = [tree.data.inbox, tree.data.habits].filter((p): p is Page => !!p);
    return [
      { label: '', pages: system },
      ...tree.data.folders.flatMap((f) => [
        { label: folderLabel(f), pages: f.pages },
        ...f.children.map((c) => ({ label: `${folderLabel(f)} › ${folderLabel(c)}`, pages: c.pages })),
      ]),
    ].filter((g) => g.pages.length > 0);
  }, [tree.data]);
  const pages = groups.flatMap((g) => g.pages);

  const lastPageId = getLastPageId();
  const target =
    pages.find((p) => p.id === chosen) ??
    pages.find((p) => p.id === lastPageId) ??
    tree.data?.inbox ??
    undefined;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close();
    // Fase de captura: o TextInput do react-native-web para a propagação do keydown
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 justify-start bg-black/50"
    >
      <Pressable accessibilityLabel="Fechar" className="absolute inset-0" onPress={close} />
      <View
        className="mx-auto w-full max-w-xl gap-3 rounded-b-2xl bg-background p-4 shadow-lg"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-lg font-bold text-foreground">Captura rápida</Text>
        <QuickAdd
          pageId={target?.id}
          autoFocus
          onCreated={() => target && toast({ message: `Criada em ${pageLabel(target)}` })}
        />
        {/* Grupos com quebra de linha (sem rolagem lateral), rolando na vertical se forem muitos */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 280 }}
          contentContainerClassName="gap-3"
          accessibilityRole="radiogroup"
          accessibilityLabel="Onde criar"
        >
          {groups.map((group) => (
            <View key={group.label || 'sistema'} className="gap-1">
              {group.label ? (
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </Text>
              ) : null}
              <View className="flex-row flex-wrap gap-2">
                {group.pages.map((page) => (
                  <Pressable
                    key={page.id}
                    accessibilityRole="radio"
                    aria-checked={page.id === target?.id}
                    onPress={() => setChosen(page.id)}
                    className={cn(
                      'min-h-11 justify-center rounded-full border px-3',
                      page.id === target?.id ? 'border-primary bg-primary' : 'border-border',
                    )}
                  >
                    <Text
                      className={
                        page.id === target?.id ? 'text-primary-foreground' : 'text-foreground'
                      }
                    >
                      {pageLabel(page)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
        <Text className="text-xs text-muted-foreground">
          Enter cria e continua aqui · Esc ou toque fora para fechar · Dica: !! prioridade,
          #etiqueta, amanhã
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
