import { Children, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

/**
 * Grade que acompanha a largura da janela (D67): 1 coluna no celular, mais no computador.
 * `breakpoints`: largura mínima para cada coluna a mais (ex.: [640, 1100] = 2 colunas a partir de 640).
 */
export function Grid({
  children,
  breakpoints = [640, 1100],
  gap = 12,
}: {
  children: ReactNode;
  breakpoints?: number[];
  gap?: number;
}) {
  const { width } = useWindowDimensions();
  const columns = 1 + breakpoints.filter((b) => width >= b).length;
  const items = Children.toArray(children);
  // flexBasis um pouco abaixo da fração exata, para o gap caber; o flexGrow completa
  const basis = `${Math.floor(100 / columns) - 5}%` as const;
  const fillers = (columns - (items.length % columns)) % columns;
  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {items.map((child, i) => (
        <View key={i} style={{ flexBasis: columns === 1 ? '100%' : basis, flexGrow: 1 }}>
          {child}
        </View>
      ))}
      {Array.from({ length: fillers }, (_, i) => (
        <View key={`fill-${i}`} style={{ flexBasis: basis, flexGrow: 1 }} />
      ))}
    </View>
  );
}
