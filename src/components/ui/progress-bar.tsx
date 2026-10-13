import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { cn } from '@/lib/cn';

/** Barra de progresso que anda suave quando o valor muda (animação curta ao concluir, ESCOPO 4.6). */
export function ProgressBar({
  value,
  className,
  fillClassName = 'bg-accent',
  label,
}: {
  value: number;
  className?: string;
  fillClassName?: string;
  label: string;
}) {
  const ratio = Math.max(0, Math.min(1, value));
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.set(withTiming(ratio, { duration: 400 }));
  }, [progress, ratio]);
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('h-2 overflow-hidden rounded-full bg-wash', className)}
    >
      {/* A cor fica num View comum: o Animated.View não recebe as classes do NativeWind */}
      <Animated.View style={[{ height: '100%' }, style]}>
        <View className={cn('h-full rounded-full', fillClassName)} />
      </Animated.View>
    </View>
  );
}
