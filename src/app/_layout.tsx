import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryProvider } from '@/providers/query';
import { SessionProvider, useSession } from '@/providers/session';
import { ToastProvider } from '@/providers/toast';

SplashScreen.preventAutoHideAsync();

// Cor de destaque da navegação (abas) = --primary do src/global.css
const lightNavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: 'rgb(109 40 217)' },
};
const darkNavTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: 'rgb(167 139 250)' } };

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    // GestureHandlerRootView: necessário para arrastar (react-native-sortables)
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={scheme === 'dark' ? darkNavTheme : lightNavTheme}>
        <SessionProvider>
          <QueryProvider>
            <ToastProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </ToastProvider>
          </QueryProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, isLoading } = useSession();

  // Esconde a splash só depois de saber se há sessão, para não piscar a tela de login
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      {/* Link de convite: abre com ou sem login (cria a conta ali mesmo) */}
      <Stack.Screen name="invite/[token]" />
      <Stack.Screen name="clan-invite/[token]" />
    </Stack>
  );
}
