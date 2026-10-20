import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import paths from '@/lib/gym/body-paths.json';
import { Text } from '@/components/ui/text';
import { MUSCLE_SLUGS, type MuscleSlug } from '@/lib/gym/muscle-volume';
import { useColors } from '@/lib/tokens';

type Figure = 'male' | 'female';
type Side = 'front' | 'back';
type BodyPaths = Record<
  Figure,
  Record<Side, { viewBox: number[]; parts: { slug: string; d: string[] }[] }>
>;

const DATA = paths as BodyPaths;
const MUSCLES = new Set<string>(MUSCLE_SLUGS);
/** Opacidade do acento por nível (0: sem trabalho) */
const OPACITY = [0, 0.3, 0.5, 0.75, 1];

/**
 * Mapa muscular (AC8.4, V6 §7): frente e costas da figura escolhida, cada músculo sombreado pelo
 * nível de trabalho (0 a 4) com as cores do tema. Contornos do MuscleMap (MIT, NOTICE.md).
 */
export function BodyMap({
  figure,
  levels,
  label,
}: {
  figure: Figure;
  levels: Partial<Record<MuscleSlug, number>>;
  label: string;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      className="flex-row gap-3"
    >
      {(['front', 'back'] as const).map((side) => {
        const { viewBox, parts } = DATA[figure][side];
        return (
          <View key={side} className="flex-1 items-center gap-1">
            <Svg viewBox={viewBox.join(' ')} width="100%" height={260}>
              <G>
                {parts.map((part) => {
                  const level = MUSCLES.has(part.slug) ? (levels[part.slug as MuscleSlug] ?? 0) : 0;
                  const fill = level > 0 ? colors.accent : colors.line;
                  return part.d.map((d, i) => (
                    <Path
                      key={`${part.slug}-${i}`}
                      d={d}
                      fill={fill}
                      fillOpacity={level > 0 ? OPACITY[level] : 1}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  ));
                })}
              </G>
            </Svg>
            <Text className="text-xs text-ink-muted">{t(`stats.${side}`)}</Text>
          </View>
        );
      })}
    </View>
  );
}
