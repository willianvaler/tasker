import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';

import { useIsWide } from '@/components/sidebar';

const icon = (emoji: string) =>
  function TabIcon() {
    // Altura de linha fixa: com a padrão do text-xl, o emoji empurrava o rótulo para fora da barra
    return <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>;
  };

// Abas embaixo no celular. Em tela larga, quem navega é a barra lateral (components/sidebar.tsx),
// que fica no layout de cima para continuar visível dentro das páginas (ESCOPO 5)
export default function TabsLayout() {
  const wide = useIsWide();

  return (
    <View className="flex-1 bg-paper">
      <Tabs
        tabBar={wide ? () => null : undefined}
        screenOptions={{
          headerShown: false,
          // No celular, a altura padrão (49) cortava o rótulo embaixo do ícone de emoji
          tabBarStyle: { height: 62 },
          tabBarItemStyle: { paddingVertical: 6 },
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Início', tabBarIcon: icon('🏠'), tabBarAccessibilityLabel: 'Início' }}
        />
        <Tabs.Screen
          name="today"
          options={{ title: 'Hoje', tabBarIcon: icon('☀️'), tabBarAccessibilityLabel: 'Hoje' }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: 'Entrada',
            tabBarIcon: icon('📥'),
            tabBarAccessibilityLabel: 'Caixa de entrada',
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{ title: 'Hábitos', tabBarIcon: icon('🔥'), tabBarAccessibilityLabel: 'Hábitos' }}
        />
        {/* Atribuídas a mim: no celular abre pelo Início (cartão "Atribuídas a mim"), sem aba própria */}
        <Tabs.Screen name="mine" options={{ title: 'Atribuídas a mim', href: null }} />
        <Tabs.Screen
          name="folders"
          options={{ title: 'Pastas', tabBarIcon: icon('📁'), tabBarAccessibilityLabel: 'Pastas' }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Perfil', tabBarIcon: icon('👤'), tabBarAccessibilityLabel: 'Perfil' }}
        />
      </Tabs>
      {!wide && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Captura rápida"
          className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg active:opacity-80"
          onPress={() => router.push('/capture')}
        >
          <Text className="text-3xl text-on-accent">+</Text>
        </Pressable>
      )}
    </View>
  );
}
