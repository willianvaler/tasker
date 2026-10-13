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
        'font-sans min-h-11 rounded border border-line bg-paper px-3 text-base text-ink',
        className,
      )}
      {...webSubmit}
      {...props}
    />
  );
});
