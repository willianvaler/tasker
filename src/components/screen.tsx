import { createContext, useContext, type ComponentProps, type ReactNode, type Ref } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type Size = 'narrow' | 'medium' | 'wide' | 'full';

// Margem lateral da coluna e o mesmo valor negativo, para a rolagem chegar até a borda dela
const GUTTER: Record<Size, { pad: string; bleed: string }> = {
  narrow: { pad: 'px-4 md:px-6', bleed: '-mx-4 md:-mx-6' },
  medium: { pad: 'px-4 md:px-8', bleed: '-mx-4 md:-mx-8' },
  wide: { pad: 'px-4 md:px-8', bleed: '-mx-4 md:-mx-8' },
  full: { pad: 'px-4 md:px-8', bleed: '-mx-4 md:-mx-8' },
};
const SizeContext = createContext<Size>('narrow');

/**
 * Área da tela. "narrow" (formulários, detalhes, texto) usa até 1024 px; "medium" (listas) até
 * 1152 px, para a linha mostrar título e detalhes lado a lado; "wide" (Início, pastas, cards,
 * kanban, personagem, loja) usa a largura do computador para colunas e grades (D67, D189).
 */
export function Screen({
  children,
  size = 'narrow',
}: {
  children: ReactNode;
  /** narrow: formulários · medium: listas · wide: painéis e grades · full: painéis de várias colunas */
  size?: Size;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-paper">
      <View
        className={cn(
          'w-full flex-1 self-center',
          GUTTER[size].pad,
          size === 'full'
            ? 'max-w-[1680px]'
            : size === 'wide'
              ? 'max-w-7xl'
              : size === 'medium'
                ? 'max-w-6xl'
                : 'max-w-5xl',
        )}
      >
        <SizeContext.Provider value={size}>{children}</SizeContext.Provider>
      </View>
    </SafeAreaView>
  );
}

/**
 * Margem da tela: `bleed` na lista que rola, `pad` no conteúdo dela (D189). `px` é o mesmo valor
 * em pixels, para rolagens animadas (o NativeWind não estiliza o Animated.ScrollView).
 */
export function useScreenGutter(explicit?: Size) {
  // Quem desenha o próprio <Screen> está fora do contexto: passa o tamanho
  const fromContext = useContext(SizeContext);
  const size = explicit ?? fromContext;
  const md = useWindowDimensions().width >= 768;
  return { ...GUTTER[size], px: !md ? 16 : size === 'narrow' ? 24 : 32 };
}

/**
 * Rolagem principal da tela (D189). Vai até a borda da margem lateral e devolve a margem por
 * dentro: a barra de rolagem fica na margem, nunca em cima do texto (no Firefox e no macOS ela
 * flutua sobre o conteúdo).
 */
export function ScreenScroll({
  className,
  contentContainerClassName,
  ref,
  ...props
}: ComponentProps<typeof ScrollView> & { ref?: Ref<ScrollView> }) {
  const gutter = useScreenGutter();
  return (
    <ScrollView
      ref={ref}
      className={cn(gutter.bleed, className)}
      contentContainerClassName={cn(gutter.pad, contentContainerClassName)}
      {...props}
    />
  );
}
