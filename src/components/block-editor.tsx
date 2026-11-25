import type { MutableRefObject } from 'react';

import type { BlockEditorApi } from '@/lib/block-editor/mount';

// No celular, o editor de blocos entra numa WebView no R1.4; até lá, a tela usa o campo de texto.
export const BLOCK_EDITOR = false;

export function BlockEditor(_props: {
  value: string;
  onChange: (md: string) => void;
  onBlur?: () => void;
  editable: boolean;
  apiRef?: MutableRefObject<BlockEditorApi | null>;
  onImage?: () => void;
  today: string;
  exclude?: string;
}) {
  return null;
}
