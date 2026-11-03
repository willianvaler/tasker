import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { SIDEBAR_NAV_MIN, SIDEBAR_WIDTH } from '@/lib/prefs';

/** O View da web não repassa o onDoubleClick: dois toques em até 350 ms contam como duplo clique */
let lastDown = 0;
function isDoubleDown() {
  const now = Date.now();
  const double = now - lastDown < 350;
  lastDown = double ? 0 : now;
  return double;
}

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
      if (isDoubleDown()) {
        onChange(SIDEBAR_WIDTH.default);
        onCommit(SIDEBAR_WIDTH.default);
        return;
      }
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

/**
 * Divisor entre os atalhos fixos (Hoje, Planejar...) e os blocos (Anotações, Pastas, Projetos), só
 * na web: arrastar para cima encolhe os atalhos (eles rolam por dentro) e dá lugar aos blocos;
 * duplo clique volta a mostrar todos; setas ↑/↓ com o foco nele mudam de 16 em 16 px. `max` é a
 * altura com todos os atalhos à vista (null: ainda não medida).
 */
export function SidebarSplit({
  height,
  max,
  onChange,
  onCommit,
}: {
  /** null: todos os atalhos à vista */
  height: number | null;
  max: number | null;
  onChange: (height: number | null) => void;
  onCommit: (height: number | null) => void;
}) {
  const { t } = useTranslation();
  if (Platform.OS !== 'web') return null;
  const full = max ?? 0;
  const current = height ?? full;
  // Chegou ao tamanho inteiro: volta a ser "todos à vista" (acompanha atalho novo)
  const fit = (h: number) => {
    const clamped = Math.max(SIDEBAR_NAV_MIN, Math.min(full, h));
    return clamped >= full - 2 ? null : clamped;
  };

  const web = {
    tabIndex: 0,
    onPointerDown: (event: PointerEvent) => {
      event.preventDefault();
      if (isDoubleDown()) {
        onChange(null);
        onCommit(null);
        return;
      }
      const startY = event.clientY;
      const start = current;
      let last: number | null = height;
      const move = (e: PointerEvent) => {
        last = fit(start + e.clientY - startY);
        onChange(last);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        onCommit(last);
      };
      document.body.style.cursor = 'row-resize';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const next = fit(current + (event.key === 'ArrowDown' ? 16 : -16));
      onChange(next);
      onCommit(next);
    },
  };

  return (
    <View
      role="separator"
      aria-orientation="horizontal"
      aria-label={t('nav.resizeSidebarNav')}
      aria-valuenow={Math.round(current)}
      aria-valuemin={SIDEBAR_NAV_MIN}
      aria-valuemax={Math.round(full)}
      // Faixa de 12 px com a linha no meio; mais forte ao passar o mouse
      className="h-3 cursor-row-resize justify-center px-2 hover:bg-accent/30 focus:bg-accent/30"
      {...(web as object)}
    >
      <View className="h-px bg-line" />
    </View>
  );
}
