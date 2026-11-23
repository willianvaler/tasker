import { type RefObject, useEffect } from 'react';

export type DroppedImage = { uri: string; name: string; mime: string };

const images = (files: FileList | null | undefined) =>
  Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));

/**
 * Colar (Ctrl+V) e arrastar imagens para o campo de texto (CD44): devolve os arquivos como endereços
 * `blob:`, que sobem pelo mesmo caminho do botão de imagem. Texto colado segue normal.
 */
export function useImageDrop(
  target: RefObject<unknown>,
  onImages: (files: DroppedImage[]) => void,
  enabled: boolean,
) {
  useEffect(() => {
    const el = target.current as HTMLElement | null;
    if (!enabled || !el?.addEventListener) return;
    const take = (files: File[]) =>
      onImages(
        files.map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name || 'imagem.png',
          mime: f.type,
        })),
      );
    const onPaste = (e: ClipboardEvent) => {
      const files = images(e.clipboardData?.files);
      if (!files.length) return;
      e.preventDefault();
      take(files);
    };
    const onDragOver = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === 'file'))
        e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const files = images(e.dataTransfer?.files);
      if (!files.length) return;
      e.preventDefault();
      take(files);
    };
    el.addEventListener('paste', onPaste);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('paste', onPaste);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, [target, onImages, enabled]);
}
