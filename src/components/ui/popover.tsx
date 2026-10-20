import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { DURATION, useColors } from '@/lib/tokens';
import { useShortcut } from '@/lib/use-shortcut';

type Rect = { x: number; y: number; width: number; height: number };

function useAnchorRect(anchor: RefObject<View | null>, open: boolean) {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!open) return;
    anchor.current?.measureInWindow((x, y, width, height) => setRect({ x, y, width, height }));
  }, [anchor, open]);
  return open ? rect : null;
}

/** Colado na âncora no computador; folha de baixo para cima no celular. */
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
  /** center: no meio da tela, sem âncora (ex.: menu Novo pelo atalho) */
  placement?: 'below' | 'above' | 'right' | 'center';
  children: ReactNode;
}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const colors = useColors();
  const measured = useAnchorRect(anchor, open && placement !== 'center');
  const rect: Rect | null =
    placement === 'center' && open
      ? { x: (window.width - width) / 2, y: window.height / 3, width, height: 0 }
      : measured;
  // Altura do conteúdo: abre para cima (ou encosta na borda) quando não cabe embaixo
  const [contentHeight, setContentHeight] = useState(0);
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

  const left = !rect
    ? 0
    : placement === 'right'
      ? Math.min(rect.x + rect.width + 8, window.width - width - 8)
      : Math.max(8, Math.min(rect.x, window.width - width - 8));
  const vertical = !rect
    ? { top: 0 }
    : placement === 'center'
      ? { top: Math.max(8, (window.height - contentHeight) / 2) }
      : placement === 'above'
        ? { bottom: window.height - rect.y + 4 }
        : fitVertically(
            placement === 'right' ? Math.max(8, rect.y - 8) : rect.y + rect.height + 4,
            rect,
            contentHeight,
            window.height,
          );

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      {backdrop}
      {rect && (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(DURATION.fast)}
          style={[{ position: 'absolute', left, width, maxHeight: window.height - 16 }, vertical]}
        >
          <View
            onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
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

/**
 * Topo do popover que abre embaixo da âncora: se passa do fim da janela, abre para cima da âncora;
 * se também não cabe em cima, encosta no fim da janela (o maxHeight cuida de telas bem baixas).
 */
export function fitVertically(top: number, rect: Rect, height: number, windowHeight: number) {
  if (!height || top + height <= windowHeight - 8) return { top };
  if (rect.y - 4 - height >= 8) return { top: rect.y - 4 - height };
  return { top: Math.max(8, windowHeight - height - 8) };
}

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
