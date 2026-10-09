import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { Sidebar, useIsWide } from '@/components/sidebar';
import { usePushTapHandler } from '@/lib/push';
import { useProfile } from '@/lib/queries/profile';
import { useRealtimeSync } from '@/providers/realtime';

export default function AppLayout() {
  useCaptureShortcut();
  useRealtimeSync();
  usePushTapHandler();
  const onboarding = useOnboarding();
  const wide = useIsWide();
  return (
    // Em tela larga, a barra lateral fica ao lado da pilha e não some ao abrir uma página
    <View className="flex-1 flex-row bg-background">
      {wide && !onboarding && <Sidebar />}
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
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
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

/** Conta nova (sem onboarded_at) vai para a introdução de 3 passos. Devolve se está nela. */
function useOnboarding() {
  const profile = useProfile();
  const pathname = usePathname();
  // Só com o perfil buscado agora: o do cache do disco pode ser de antes de concluir a introdução
  const pending = profile.isFetchedAfterMount && !!profile.data && !profile.data.onboarded_at;
  useEffect(() => {
    if (pending && pathname !== '/onboarding') router.replace('/onboarding');
  }, [pending, pathname]);
  return pathname === '/onboarding';
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
