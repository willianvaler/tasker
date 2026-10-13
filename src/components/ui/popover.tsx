import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { DURATION, useColors } from '@/lib/tokens';
import { useShortcut } from '@/lib/use-shortcut';

type Rect = { x: number; y: number; width: number; height: number };

/** Mede onde o elemento âncora está na janela (para abrir o popover colado nele). */
function useAnchorRect(anchor: RefObject<View | null>, open: boolean) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!open) return;
    anchor.current?.measureInWindow((x, y, width, height) => setRect({ x, y, width, height }));
  }, [anchor, open]);
  return open ? rect : null;
}

/**
 * Menu ou seletor preso a um botão (menu "+ Novo", ícones, "⋯"). No computador abre colado na
 * âncora (embaixo, ou em cima se não couber), com borda e uma sombra mínima, a única do app; no
 * celular vira folha de baixo para cima. Esc ou tocar fora fecha.
 */
export function Popover({
  anchor,
  open,
  onClose,
  width = 240,
  placement = 'below',
  children,
}: {
  anchor: RefObject<View | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  placement?: 'below' | 'above' | 'right';
  children: ReactNode;
}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const colors = useColors();
  const rect = useAnchorRect(anchor, open);
  const wide = window.width >= 768;
  useShortcut('overlay.close', onClose, open);
  if (!open) return null;

  const backdrop = (
    <Pressable
      accessibilityLabel={t('common.close')}
      className="absolute inset-0"
      onPress={onClose}
    />
  );

  if (!wide)
    return (
      <Modal transparent animationType="none" onRequestClose={onClose}>
        <View className="flex-1 justify-end bg-scrim/40">
          {backdrop}
          <Animated.View entering={reduced ? undefined : SlideInDown.duration(DURATION.slow)}>
            {/* As classes num View comum: o NativeWind não estiliza o Animated.View */}
            <View
              className="rounded-t-lg border-t border-line bg-surface p-2"
              style={{ paddingBottom: insets.bottom + 8 }}
            >
              {children}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );

  // Posição: embaixo, em cima ou à direita da âncora, sem sair da janela
  const left = !rect
    ? 0
    : placement === 'right'
      ? Math.min(rect.x + rect.width + 8, window.width - width - 8)
      : Math.max(8, Math.min(rect.x, window.width - width - 8));
  const vertical = !rect
    ? { top: 0 }
    : placement === 'above'
      ? { bottom: window.height - rect.y + 4 }
      : placement === 'right'
        ? { top: Math.max(8, rect.y - 8) }
        : { top: rect.y + rect.height + 4 };

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      {backdrop}
      {rect && (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(DURATION.fast)}
          style={[{ position: 'absolute', left, width, maxHeight: window.height - 16 }, vertical]}
        >
          <View
            className="rounded-lg border border-line bg-surface p-1"
            style={{
              shadowColor: colors.scrim,
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            {children}
          </View>
        </Animated.View>
      )}
    </Modal>
  );
}

/** Item de menu: 32 px no computador, 44 no celular, com atalho à direita (em mono). */
export function MenuItem({
  label,
  icon,
  shortcut,
  danger,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      className="min-h-11 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash md:min-h-8"
      onPress={onPress}
    >
      {icon}
      <MenuLabel danger={danger}>{label}</MenuLabel>
      {shortcut && <MenuShortcut>{shortcut}</MenuShortcut>}
    </Pressable>
  );
}

function MenuLabel({ danger, children }: { danger?: boolean; children: string }) {
  return (
    <Text className={danger ? 'flex-1 text-sm text-danger' : 'flex-1 text-sm text-ink'}>
      {children}
    </Text>
  );
}

function MenuShortcut({ children }: { children: string }) {
  return (
    <Text className="rounded border border-line px-1 font-mono text-xs text-ink-muted">
      {children}
    </Text>
  );
}
