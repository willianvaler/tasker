import { forwardRef } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/tokens';

export const Input = forwardRef<TextInput, TextInputProps & { className?: string }>(function Input(
  { className, ...props },
  ref,
) {
  // O react-native-web ainda não lê o submitBehavior, só o antigo blurOnSubmit (que saiu dos tipos do RN).
  // Sem isso, na web o campo perde o foco no Enter mesmo com submitBehavior="submit".
  const colors = useColors();
  const webSubmit =
    Platform.OS === 'web' && props.submitBehavior === 'submit'
      ? ({ blurOnSubmit: false } as object)
      : {};

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors['ink-muted']}
      className={cn(
        // 44 px no celular, 32 no computador; 16 px de fonte no celular (o iOS dá zoom abaixo disso)
        'min-h-11 rounded border border-line bg-surface px-3 font-sans text-base text-ink',
        'hover:border-ink-muted focus:border-accent md:min-h-8 md:text-sm',
        className,
      )}
      {...webSubmit}
      {...props}
    />
  );
});
