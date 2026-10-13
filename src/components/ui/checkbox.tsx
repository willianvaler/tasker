import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { cn } from '@/lib/cn';
import { DURATION, useColors } from '@/lib/tokens';

/**
 * Caixa de marcar "carimbo" (docs/DESIGN.md): marcada, vira um X traçado à mão no acento, que
 * aparece com um "carimbar" curto. A caixa visível tem 18 px; a área de toque, 44 px no celular e
 * 32 px no computador. Com "reduzir movimento", aparece direto.
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      // aria-* (e não accessibilityState): o react-native-web só repassa estes para o HTML
      aria-checked={checked}
      aria-disabled={disabled}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      className={cn(
        'h-11 w-11 items-center justify-center md:h-8 md:w-8',
        disabled && 'opacity-40',
      )}
      onPress={() => onChange(!checked)}
    >
      <StampBox checked={checked} />
    </Pressable>
  );
}

/**
 * O desenho da caixa (18 px) com o X de caneta que aparece "carimbando". Sozinho, serve onde o
 * elemento inteiro já é a caixa de marcar (o card da página de cards).
 */
export function StampBox({ checked, size = 18 }: { checked: boolean; size?: 18 | 24 }) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const stamp = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    const to = checked ? 1 : 0;
    stamp.set(
      reduced || !checked
        ? to
        : withTiming(to, { duration: DURATION.slow, easing: Easing.out(Easing.quad) }),
    );
  }, [checked, reduced, stamp]);

  const mark = useAnimatedStyle(() => ({
    opacity: stamp.get(),
    transform: [{ scale: 1.4 - 0.4 * stamp.get() }, { rotate: `${(1 - stamp.get()) * -8}deg` }],
  }));

  const pad = size / 6;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 18 18">
        <Rect
          x={0.75}
          y={0.75}
          width={16.5}
          height={16.5}
          rx={3}
          fill="none"
          stroke={checked ? colors.accent : colors['ink-muted']}
          strokeWidth={1.5}
        />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -pad,
            top: -pad,
            width: size + 2 * pad,
            height: size + 2 * pad,
          },
          mark,
        ]}
      >
        <Svg width={size + 2 * pad} height={size + 2 * pad} viewBox="0 0 20 20">
          {/* Dois traços levemente curvos, como um X de caneta */}
          <Path
            d="M4 5.5 C8 9 12 13 16.5 15.5 M15.5 4.5 C12 8 8 12.5 4.5 15.8"
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
