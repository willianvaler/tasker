import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { SIDEBAR_WIDTH } from '@/lib/prefs';

const clamp = (w: number) => Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, w));

/**
 * Divisor na borda direita da barra lateral (só na web): arrastar muda a largura, duplo clique
 * volta ao padrão, setas ←/→ com o foco nele mudam de 16 em 16 px.
 */
export function SidebarResizer({
  width,
  onChange,
  onCommit,
}: {
  width: number;
  onChange: (width: number) => void;
  onCommit: (width: number) => void;
}) {
  const { t } = useTranslation();
  if (Platform.OS !== 'web') return null;

  const web = {
    tabIndex: 0,
    onPointerDown: (event: PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const start = width;
      let last = start;
      const move = (e: PointerEvent) => {
        last = clamp(start + e.clientX - startX);
        onChange(last);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        onCommit(last);
      };
      document.body.style.cursor = 'col-resize';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    onDoubleClick: () => {
      onChange(SIDEBAR_WIDTH.default);
      onCommit(SIDEBAR_WIDTH.default);
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next = clamp(width + (event.key === 'ArrowRight' ? 16 : -16));
      onChange(next);
      onCommit(next);
    },
  };

  return (
    <View
      role="separator"
      aria-orientation="vertical"
      aria-label={t('nav.resizeSidebar')}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      // Faixa de 6 px sobre a borda; a linha aparece ao passar o mouse
      className="absolute -right-1 bottom-0 top-0 z-10 w-2 cursor-col-resize hover:bg-accent/30 focus:bg-accent/30"
      {...(web as object)}
    />
  );
}
