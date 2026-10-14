import { router, Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { CommandPaletteProvider } from '@/components/command-palette';
import { ListKeys } from '@/components/list-keys';
import { NewMenuProvider } from '@/components/new-menu';
import { Sidebar, useIsWide } from '@/components/sidebar';
import { SyncDot } from '@/components/sync-dot';
import { SyncRejections } from '@/components/sync-rejections';
import { useLocaleSync } from '@/i18n/use-locale';
import { usePushTapHandler } from '@/lib/push';
import { useSidebarHidden } from '@/lib/ui-state';
import { useProfile } from '@/lib/queries/profile';
import { useRealtimeSync } from '@/providers/realtime';

export default function AppLayout() {
  useRealtimeSync();
  usePushTapHandler();
  useLocaleSync();
  const onboarding = useOnboarding();
  const wide = useIsWide();
  const sidebarHidden = useSidebarHidden();
  return (
    // Em tela larga, a barra lateral fica ao lado da pilha e não some ao abrir uma página
    <CommandPaletteProvider>
      <NewMenuProvider>
        <View className="flex-1 flex-row bg-paper">
          {wide && !onboarding && !sidebarHidden && <Sidebar />}
          <View className="flex-1">
            <ListKeys />
            <SyncRejections />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="page/[id]" />
              <Stack.Screen name="folder/[id]" />
              <Stack.Screen name="share/[id]" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="clan" />
              <Stack.Screen name="teams" />
              <Stack.Screen name="team/[id]" />
              <Stack.Screen name="character" />
              <Stack.Screen name="shop" />
              <Stack.Screen name="ajuda" />
              <Stack.Screen name="sync" />
              <Stack.Screen name="lixeira" />
              <Stack.Screen name="templates" options={{ presentation: 'modal' }} />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              {/* Painel da tarefa: o Sheet desenha o painel e a animação; a lista atrás continua viva */}
              <Stack.Screen
                name="task/[id]"
                options={{ presentation: 'transparentModal', animation: 'none' }}
              />
              <Stack.Screen
                name="task/new"
                options={{ presentation: 'transparentModal', animation: 'none' }}
              />
              <Stack.Screen
                name="capture"
                options={{ presentation: 'transparentModal', animation: 'fade' }}
              />
              <Stack.Screen name="batch" options={{ presentation: 'modal' }} />
            </Stack>
            {!wide && !onboarding && <SyncDot floating />}
          </View>
        </View>
      </NewMenuProvider>
    </CommandPaletteProvider>
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
