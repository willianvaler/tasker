import { useColorScheme } from 'nativewind';
import { Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';
import { useThemePreference } from '@/providers/theme';

/**
 * Atalho de claro/escuro (D55, D67): troca para o oposto do que está na tela. A opção "Sistema"
 * continua no Perfil.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { colorScheme } = useColorScheme();
  const { setPreference } = useThemePreference();
  const dark = colorScheme === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      onPress={() => setPreference(dark ? 'light' : 'dark')}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full active:bg-wash',
        className,
      )}
    >
      <Text style={{ fontSize: 18, lineHeight: 22 }}>{dark ? '☀️' : '🌙'}</Text>
    </Pressable>
  );
}
