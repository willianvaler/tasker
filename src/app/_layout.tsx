import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QueryProvider } from '@/providers/query';
import { SessionProvider, useSession } from '@/providers/session';
import { ThemeProvider } from '@/providers/theme';
import { ToastProvider } from '@/providers/toast';

SplashScreen.preventAutoHideAsync();

// Cor de destaque da navegação (abas) = --primary do src/global.css
const lightNavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: 'rgb(109 40 217)' },
};
const darkNavTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: 'rgb(167 139 250)' } };

export default function RootLayout() {
  return (
    // GestureHandlerRootView: necessário para arrastar (react-native-sortables)
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApp() {
  // Do NativeWind: segue a escolha de tema (Sistema, Claro, Escuro), não só o sistema
  const { colorScheme } = useColorScheme();
  return (
    <NavThemeProvider value={colorScheme === 'dark' ? darkNavTheme : lightNavTheme}>
      <SessionProvider>
        <QueryProvider>
          <ToastProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </ToastProvider>
        </QueryProvider>
      </SessionProvider>
    </NavThemeProvider>
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
