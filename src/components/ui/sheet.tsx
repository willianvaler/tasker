import type { ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  SlideInDown,
  SlideInRight,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DURATION, SIZE } from '@/lib/tokens';
import { useShortcut } from '@/lib/use-shortcut';

/** Painel à direita no computador (sem travar a lista), folha no celular. Rota `transparentModal`. */
export function Sheet({
  onClose,
  header,
  children,
}: {
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const wide = width >= 768;
  useShortcut('overlay.close', onClose);

  if (wide)
    return (
      // box-none: o que está fora do painel continua clicável (a lista ao lado)
      <View pointerEvents="box-none" className="flex-1 flex-row justify-end">
        <Animated.View
          entering={reduced ? undefined : SlideInRight.duration(DURATION.base)}
          style={{ width: SIZE.panel, height: '100%' }}
        >
          {/* As classes num View comum: o NativeWind não estiliza o Animated.View */}
          <View
            className="flex-1 border-l border-line bg-surface"
            style={{ paddingTop: insets.top }}
          >
            {header}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-6 p-4 pb-12"
            >
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    );

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(DURATION.base)}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <Pressable
          accessibilityLabel={t('common.close')}
          className="flex-1 bg-scrim/40"
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        entering={reduced ? undefined : SlideInDown.duration(DURATION.slow)}
        style={{ maxHeight: '92%' }}
      >
        <View
          className="rounded-t-lg border-t border-line bg-surface"
          style={{ paddingBottom: insets.bottom }}
        >
          <View className="items-center pt-2">
            <View className="h-1 w-8 rounded-full bg-line" />
          </View>
          {header}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-6 p-4 pb-8"
          >
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}
