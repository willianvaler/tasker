import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { Sidebar, useIsWide } from '@/components/sidebar';
import { useRealtimeSync } from '@/providers/realtime';

export default function AppLayout() {
  useCaptureShortcut();
  useRealtimeSync();
  const wide = useIsWide();
  return (
    // Em tela larga, a barra lateral fica ao lado da pilha e não some ao abrir uma página
    <View className="flex-1 flex-row bg-background">
      {wide && <Sidebar />}
      <View className="flex-1">
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="page/[id]" />
          <Stack.Screen name="folder/[id]" />
          <Stack.Screen name="share/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="clan" />
          <Stack.Screen name="templates" options={{ presentation: 'modal' }} />
          <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="capture"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen name="batch" options={{ presentation: 'modal' }} />
        </Stack>
      </View>
    </View>
  );
}

/** Na web: "N" ou Ctrl/Cmd+K abre a captura rápida de qualquer tela (ESCOPO 4.1). */
function useCaptureShortcut() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      const ctrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const n =
        !typing &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'n';
      if (ctrlK || n) {
        event.preventDefault();
        router.push('/capture');
      }
    };
    // Fase de captura: o TextInput do react-native-web para a propagação do keydown
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
