import { forwardRef } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

export const Input = forwardRef<TextInput, TextInputProps & { className?: string }>(function Input(
  { className, ...props },
  ref,
) {
  // O react-native-web ainda não lê o submitBehavior, só o antigo blurOnSubmit (que saiu dos tipos do RN).
  // Sem isso, na web o campo perde o foco no Enter mesmo com submitBehavior="submit".
  const webSubmit =
    Platform.OS === 'web' && props.submitBehavior === 'submit'
      ? ({ blurOnSubmit: false } as object)
      : {};

  return (
    <TextInput
      ref={ref}
      placeholderTextColor="#94a3b8"
      className={cn(
        'min-h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground',
        className,
      )}
      {...webSubmit}
      {...props}
    />
  );
});
