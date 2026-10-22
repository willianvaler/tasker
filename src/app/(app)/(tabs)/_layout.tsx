import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useIsWide } from '@/components/sidebar';
import { QuestTabBar } from '@/components/tab-bar';

// Barra de baixo no celular: Hoje · duas posições escolhidas · + · Mais (D258, components/tab-bar).
// Todas as telas de índice são rotas daqui, para poderem ocupar uma posição; as que não estão na
// barra abrem pelo Mais. Em tela larga a barra some e quem navega é a barra lateral
// (components/sidebar.tsx), que fica no layout de cima para continuar visível dentro das páginas.
export default function TabsLayout() {
  const wide = useIsWide();
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-paper">
      <Tabs
        tabBar={wide ? () => null : (props) => <QuestTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('nav.today') }} />
        <Tabs.Screen name="planejar" options={{ title: t('nav.plan') }} />
        <Tabs.Screen name="inbox" options={{ title: t('nav.inbox') }} />
        <Tabs.Screen name="habits" options={{ title: t('nav.habits') }} />
        <Tabs.Screen name="folders" options={{ title: t('nav.folders') }} />
        <Tabs.Screen name="treino" options={{ title: t('nav.workout') }} />
        <Tabs.Screen name="bem-estar" options={{ title: t('nav.wellness') }} />
        <Tabs.Screen name="jogo" options={{ title: t('nav.game') }} />
        <Tabs.Screen name="pessoas" options={{ title: t('nav.people') }} />
        <Tabs.Screen name="mine" options={{ title: t('nav.mine') }} />
        <Tabs.Screen name="mais" options={{ title: t('nav.more') }} />
        {/* /today antigo: redireciona para a Hoje (/) */}
        <Tabs.Screen name="today" options={{ title: t('nav.today') }} />
      </Tabs>
    </View>
  );
}
