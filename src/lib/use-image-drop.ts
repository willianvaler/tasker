import type { RefObject } from 'react';

export type DroppedImage = { uri: string; name: string; mime: string };

/** No celular, a imagem entra pelo botão (colar e arrastar são da web) */
export function useImageDrop(
  _target: RefObject<unknown>,
  _onImages: (files: DroppedImage[]) => void,
  _enabled: boolean,
) {}
