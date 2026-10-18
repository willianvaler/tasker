import { useColorScheme } from 'nativewind';
import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { useThemePreference } from '@/providers/theme';

/**
 * Atalho de claro/escuro: troca para o oposto do que está na tela. A opção "Sistema"
 * continua no Perfil.
 * Quando `withLabel` é true, exibe o nome do tema alvo ao lado do ícone.
 */
export function ThemeToggle({
  className,
  withLabel = false,
}: {
  className?: string;
  withLabel?: boolean;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { setPreference } = useThemePreference();
  const dark = colorScheme === 'dark';
  const targetTheme = dark ? 'light' : 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dark ? t('themeToggle.useLight') : t('themeToggle.useDark')}
      onPress={() => setPreference(targetTheme)}
      className={cn(
        'h-11 items-center justify-center rounded hover:bg-wash active:bg-wash md:h-8',
        withLabel ? 'flex-row gap-2 px-2' : 'w-11 md:w-8',
        className,
      )}
    >
      <Icon icon={dark ? Sun : Moon} size={20} tone="ink-muted" />
      {withLabel && (
        <Text className="text-sm text-ink-muted">{t(`themeToggle.${targetTheme}`)}</Text>
      )}
    </Pressable>
  );
}
