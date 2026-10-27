import { Platform } from 'react-native';

/**
 * Clique direito (web) abre o mesmo menu do botão "…" da linha, no lugar do menu do navegador.
 * Espalhe no `View` da linha: `<View {...contextMenu(onMenu)}>`. No celular não faz nada.
 */
export function contextMenu(open: (() => void) | undefined) {
  if (Platform.OS !== 'web' || !open) return {};
  return {
    onContextMenu: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      open();
    },
  };
}
