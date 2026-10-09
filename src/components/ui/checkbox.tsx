import { Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';

/**
 * Caixa de marcar com área de toque de 44px (a caixa visível é menor). Ao marcar, dá um pulso
 * curto (o Reanimated respeita o "reduzir movimento" do sistema).
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
  const scale = useSharedValue(1);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      // aria-* (e não accessibilityState): o react-native-web só repassa estes para o HTML
      aria-checked={checked}
      aria-disabled={disabled}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      className={cn('h-11 w-11 items-center justify-center', disabled && 'opacity-50')}
      onPress={() => {
        if (!checked)
          scale.set(
            withSequence(withTiming(1.3, { duration: 90 }), withSpring(1, { damping: 10 })),
          );
        onChange(!checked);
      }}
    >
      <Animated.View style={pulse}>
        {/* Classes num View comum dentro do Animated.View: o NativeWind não estiliza o Animated.View */}
        <CheckCircle checked={checked} />
      </Animated.View>
    </Pressable>
  );
}

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <Text
      className={cn(
        'h-6 w-6 overflow-hidden rounded-full border-2 text-center text-xs font-bold leading-5',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-muted-foreground text-transparent',
      )}
    >
      ✓
    </Text>
  );
}
