import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { DURATION } from '@/lib/tokens';

export function ProgressBar({
  value,
  className,
  fillClassName = 'bg-accent',
  label,
  thick,
}: {
  value: number;
  /** Barra de 8 px arredondada, com fundo visível (vida dos bosses); o padrão é o fio de 2 px */
  thick?: boolean;
  className?: string;
  fillClassName?: string;
  label: string;
}) {
  const ratio = Math.max(0, Math.min(1, value));
  const reduced = useReducedMotion();
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.set(reduced ? ratio : withTiming(ratio, { duration: DURATION.slow }));
  }, [progress, ratio, reduced]);
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn(
        'overflow-hidden',
        thick ? 'h-2 rounded-full bg-wash' : 'h-0.5 bg-line',
        className,
      )}
    >
      {/* A cor fica num View comum: o Animated.View não recebe as classes do NativeWind */}
      <Animated.View style={[{ height: '100%' }, style]}>
        <View className={cn('h-full', fillClassName)} />
      </Animated.View>
    </View>
  );
}
