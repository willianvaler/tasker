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
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ColorValue } from 'react-native';

import { useNewMenu } from '@/components/new-menu';
import { useIsWide } from '@/components/sidebar';
import { Icon } from '@/components/ui/icon';
import { FONT_FAMILY } from '@/lib/fonts';

// Ícone da aba: a cor vem da barra (ativa = tinta, inativa = tinta suave, pelo tema da navegação)
const tabIcon = (Glyph: LucideIcon) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Glyph size={20} color={String(color)} strokeWidth={1.5} absoluteStrokeWidth />;
  };

// Abas embaixo no celular. Em tela larga, quem navega é a barra lateral
// (components/sidebar.tsx), que fica no layout de cima para continuar visível dentro das páginas.
export default function TabsLayout() {
  const wide = useIsWide();
  const { t } = useTranslation();
  const newMenu = useNewMenu();
  const fab = useRef<View>(null);

  return (
    <View className="flex-1 bg-paper">
      <Tabs
        tabBar={wide ? () => null : undefined}
        screenOptions={{
          headerShown: false,
          // Cada aba tem 5 px de padding e ícone de 28 px: com 4 px na barra sobram 56 px, e o rótulo
          // de 12/16 cabe (com 8 px ficava com 9 px de altura, cortado). Só a borda fina em cima.
          tabBarStyle: { height: 64, paddingTop: 4, paddingBottom: 4, borderTopWidth: 1 },
          tabBarLabelStyle: { fontFamily: FONT_FAMILY.sans, fontSize: 12, lineHeight: 16 },
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
        // "+" abre o menu Novo, como folha de baixo para cima
        <View ref={fab} collapsable={false} className="absolute bottom-24 right-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('newMenu.button')}
            className="h-12 w-12 items-center justify-center rounded bg-accent active:opacity-80"
            onPress={() => newMenu.open(fab)}
          >
            <Icon icon={Plus} size={24} tone="on-accent" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
