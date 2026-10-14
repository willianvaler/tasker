import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ListKeys } from '@/components/list-keys';
import { NewMenuProvider } from '@/components/new-menu';
import { OfflineBanner } from '@/components/offline-banner';
import { Sidebar, useIsWide } from '@/components/sidebar';
import { useLocaleSync } from '@/i18n/use-locale';
import { usePushTapHandler } from '@/lib/push';
import { useShortcut } from '@/lib/use-shortcut';
import { useProfile } from '@/lib/queries/profile';
import { useRealtimeSync } from '@/providers/realtime';

export default function AppLayout() {
  useCaptureShortcut();
  useRealtimeSync();
  usePushTapHandler();
  useLocaleSync();
  const onboarding = useOnboarding();
  const wide = useIsWide();
  return (
    // Em tela larga, a barra lateral fica ao lado da pilha e não some ao abrir uma página
    <NewMenuProvider>
      <View className="flex-1 flex-row bg-paper">
        {wide && !onboarding && <Sidebar />}
        <View className="flex-1">
          <OfflineBanner />
          <ListKeys />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="page/[id]" />
            <Stack.Screen name="folder/[id]" />
            <Stack.Screen name="share/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="clan" />
            <Stack.Screen name="character" />
            <Stack.Screen name="shop" />
            <Stack.Screen name="templates" options={{ presentation: 'modal' }} />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            {/* Painel da tarefa: o Sheet desenha o painel e a animação; a lista atrás continua viva */}
            <Stack.Screen
              name="task/[id]"
              options={{ presentation: 'transparentModal', animation: 'none' }}
            />
            <Stack.Screen
              name="capture"
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
            <Stack.Screen name="batch" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
      </View>
    </NewMenuProvider>
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
  useShortcut('capture.open', () => router.push('/capture'));
}
