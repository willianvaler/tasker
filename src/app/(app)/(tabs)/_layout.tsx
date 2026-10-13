import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import {
  House,
  Inbox,
  LayoutGrid,
  Plus,
  Repeat,
  Sun,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ColorValue } from 'react-native';

import { useIsWide } from '@/components/sidebar';
import { Icon } from '@/components/ui/icon';
import { FONT_FAMILY } from '@/lib/fonts';

// Ícone da aba: a cor vem da barra (ativa = tinta, inativa = tinta suave, pelo tema da navegação)
const tabIcon = (Glyph: LucideIcon) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Glyph size={20} color={String(color)} strokeWidth={1.5} absoluteStrokeWidth />;
  };

// Abas embaixo no celular (D69, D76). Em tela larga, quem navega é a barra lateral
// (components/sidebar.tsx), que fica no layout de cima para continuar visível dentro das páginas.
export default function TabsLayout() {
  const wide = useIsWide();
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-paper">
      <Tabs
        tabBar={wide ? () => null : undefined}
        screenOptions={{
          headerShown: false,
          // Altura calculada pela barra (com a área segura); só a borda fina em cima
          tabBarStyle: { borderTopWidth: 1 },
          tabBarLabelStyle: { fontFamily: FONT_FAMILY.sans, fontSize: 12 },
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('nav.home'),
            tabBarIcon: tabIcon(House),
            tabBarAccessibilityLabel: t('nav.home'),
          }}
        />
        <Tabs.Screen
          name="today"
          options={{
            title: t('nav.today'),
            tabBarIcon: tabIcon(Sun),
            tabBarAccessibilityLabel: t('nav.today'),
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: t('nav.inboxShort'),
            tabBarIcon: tabIcon(Inbox),
            tabBarAccessibilityLabel: t('nav.inbox'),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: t('nav.habits'),
            tabBarIcon: tabIcon(Repeat),
            tabBarAccessibilityLabel: t('nav.habits'),
          }}
        />
        {/* Atribuídas a mim: no celular abre pelo Início (cartão "Atribuídas a mim"), sem aba própria */}
        <Tabs.Screen name="mine" options={{ title: t('nav.mine'), href: null }} />
        <Tabs.Screen
          name="folders"
          options={{
            title: t('nav.folders'),
            tabBarIcon: tabIcon(LayoutGrid),
            tabBarAccessibilityLabel: t('nav.folders'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('nav.profile'),
            tabBarIcon: tabIcon(User),
            tabBarAccessibilityLabel: t('nav.profile'),
          }}
        />
      </Tabs>
      {!wide && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nav.quickCapture')}
          className="absolute bottom-24 right-4 h-12 w-12 items-center justify-center rounded bg-accent active:opacity-80"
          onPress={() => router.push('/capture')}
        >
          <Icon icon={Plus} size={24} tone="on-accent" />
        </Pressable>
      )}
    </View>
  );
}
