import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { isTabPath } from '@/lib/tab-slots';
import { DURATION, SIZE } from '@/lib/tokens';

type Toast = {
  id: number;
  message: string;
  /** `redo`: refaz o que o "Desfazer" desfez (Shift+Z, C6); sem ele, não há o que refazer */
  action?: { label: string; onPress: () => void; redo?: () => void };
  /** Identifica o aviso para uma atualização depois (ex.: a recompensa que chega do servidor) */
  key?: string;
  /**
   * Só atualiza o aviso com a mesma `key` se ele ainda estiver na tela, sem reiniciar o tempo;
   * se já saiu, não volta (a recompensa atrasada reabria o aviso e ele parecia não fechar)
   */
  update?: boolean;
};
export type ToastInput = Omit<Toast, 'id'>;

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** Pedido do dono (16/10): o aviso fecha sozinho em 10 s, contados de quando apareceu */
export const TOAST_MS = 10_000;

/** Ação do aviso na tela (o "Desfazer"), para o Ctrl+Z. */
let visibleAction: (() => void) | null = null;

/** O que o último "Desfazer" desfez, para o Shift+Z; vale enquanto o aviso valeria. */
let redoAction: { run: () => void; until: number } | null = null;

/** Roda o "Desfazer" do aviso que está na tela; devolve false se não há o que desfazer. */
export function undoLast() {
  if (!visibleAction) return false;
  visibleAction();
  return true;
}

/** Refaz o último "Desfazer" (que, refeito, volta a mostrar o aviso com "Desfazer"). */
export function redoLast() {
  if (!redoAction || Date.now() > redoAction.until) return false;
  const { run } = redoAction;
  redoAction = null;
  run();
  return true;
}

/** Aviso curto no rodapé, com ação opcional (ex.: "Desfazer"). Um por vez; o novo substitui o anterior. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const current = useRef<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const reduced = useReducedMotion();
  const pathname = usePathname();
  // Doca (D260): no Modo Treino o aviso vai para o topo (embaixo ficam "Feita" e "Pular exercício");
  // nas telas com a barra de baixo, acima dela e do timer encaixado; nas outras, acima do timer
  // flutuante
  const inWorkout = (pathname ?? '').startsWith('/treino/');
  // (o timer flutuante fica no mesmo canto de baixo, no computador e nas telas sem barra)
  const bottom = !wide && isTabPath(pathname) ? 64 + 44 + 16 : SIZE.timerBar + 44 + 16;

  const show = useCallback((next: ToastInput) => {
    const visible = current.current;
    if (next.update) {
      // Atualiza o que está na tela, no mesmo tempo; o que já saiu não volta
      if (!visible || !next.key || visible.key !== next.key) return;
      const updated = { ...visible, message: next.message, action: next.action ?? visible.action };
      current.current = updated;
      setToast(updated);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    const shown = { ...next, id };
    current.current = shown;
    setToast(shown);
    if (next.action) redoAction = null;
    visibleAction = next.action
      ? () => {
          next.action?.onPress();
          visibleAction = null;
          const redo = next.action?.redo;
          redoAction = redo ? { run: redo, until: Date.now() + TOAST_MS } : null;
          if (current.current?.id === id) current.current = null;
          setToast((t) => (t?.id === id ? null : t));
        }
      : null;
    timer.current = setTimeout(() => {
      if (current.current?.id === id) current.current = null;
      setToast((t) => (t?.id === id ? null : t));
      if (visibleAction && next.action) visibleAction = null;
    }, TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 items-center px-4 md:items-end md:px-6"
          style={inWorkout ? { top: insets.top + 16 } : { bottom: insets.bottom + bottom }}
        >
          {/* Tinta sobre papel invertida: o aviso se destaca sem sombra nem cor nova */}
          <Animated.View
            key={toast.id}
            entering={reduced ? undefined : FadeInDown.duration(DURATION.base)}
            accessibilityRole="alert"
            style={{ width: '100%', maxWidth: 448 }}
          >
            {/* As classes ficam num View comum: o NativeWind não estiliza o Animated.View */}
            <View className="flex-row items-center justify-between gap-3 rounded bg-ink py-1 pl-4 pr-1">
              <Text className="flex-1 text-sm text-paper" numberOfLines={4}>
                {toast.message}
              </Text>
              {toast.action && (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-11 justify-center rounded px-3 md:min-h-8"
                  onPress={() => {
                    // Pelo mesmo caminho do Ctrl+Z, para o Shift+Z poder refazer
                    if (undoLast()) return;
                    toast.action?.onPress();
                    current.current = null;
                    setToast(null);
                  }}
                >
                  <Text className="text-sm font-semibold text-accent">{toast.action.label}</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
