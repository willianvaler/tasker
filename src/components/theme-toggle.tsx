import { useColorScheme } from 'nativewind';
import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { useThemePreference } from '@/providers/theme';

/**
 * Atalho de claro/escuro: troca para o oposto do que está na tela. A opção "Sistema"
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
        'h-11 w-11 items-center justify-center rounded hover:bg-wash active:bg-wash md:h-8 md:w-8',
        className,
      )}
    >
      <Icon icon={dark ? Sun : Moon} size={20} tone="ink-muted" />
    </Pressable>
  );
}
