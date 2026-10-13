import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DURATION } from '@/lib/tokens';

type Toast = { id: number; message: string; action?: { label: string; onPress: () => void } };

const ToastContext = createContext<(toast: Omit<Toast, 'id'>) => void>(() => {});

const DURATION_MS = 5000;

/** Aviso curto no rodapé, com ação opcional (ex.: "Desfazer"). Um por vez; o novo substitui o anterior. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const reduced = useReducedMotion();

  const show = useCallback((next: Omit<Toast, 'id'>) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...next, id });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 items-center px-4 md:items-end md:px-6"
          style={{ bottom: insets.bottom + (wide ? 24 : 72) }}
        >
          {/* Tinta sobre papel invertida: o aviso se destaca sem sombra nem cor nova */}
          <Animated.View
            key={toast.id}
            entering={reduced ? undefined : FadeInDown.duration(DURATION.base)}
            accessibilityRole="alert"
            className="w-full max-w-md flex-row items-center justify-between gap-3 rounded bg-ink py-1 pl-4 pr-1"
          >
            <Text className="flex-1 text-sm text-paper" numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action && (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center rounded px-3 md:min-h-8"
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
              >
                <Text className="text-sm font-semibold text-accent">{toast.action.label}</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
