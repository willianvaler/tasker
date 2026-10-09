import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Toast = { id: number; message: string; action?: { label: string; onPress: () => void } };

const ToastContext = createContext<(toast: Omit<Toast, 'id'>) => void>(() => {});

const DURATION_MS = 5000;

/** Aviso curto no rodapé, com ação opcional (ex.: "Desfazer"). Um por vez; o novo substitui o anterior. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

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
          className="absolute inset-x-0 items-center px-4"
          style={{ bottom: insets.bottom + 72 }}
        >
          <View
            accessibilityRole="alert"
            className="w-full max-w-md flex-row items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-2 shadow-lg"
          >
            <Text className="flex-1 text-background" numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action && (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center px-2"
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
              >
                <Text className="font-bold text-primary">{toast.action.label}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
