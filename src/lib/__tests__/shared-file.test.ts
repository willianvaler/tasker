import { describe, expect, it } from '@jest/globals';

import { fileTitle, sharedFile } from '../shared-content';

const limits = {
  maxBytes: 10 * 1024 * 1024,
  compressible: (mime: string | null) => !!mime && /^image\/(jpeg|png|webp|heic)$/.test(mime),
};
const MB = 1024 * 1024;

describe('arquivo compartilhado (CP1)', () => {
  it('sem arquivo, nada', () => {
    expect(sharedFile({}, limits)).toEqual({ file: null, problem: null });
  });
  it('imagem e PDF dentro do limite viram anexo', () => {
    const r = sharedFile(
      { fileUri: 'file:///c/a.pdf', fileName: 'Nota.pdf', fileMime: 'application/pdf', fileSize: String(2 * MB) },
      limits,
    );
    expect(r).toEqual({
      file: { uri: 'file:///c/a.pdf', name: 'Nota.pdf', mime: 'application/pdf', size: 2 * MB },
      problem: null,
    });
  });
  it('foto grande passa (o anexo reduz), PDF grande não', () => {
    expect(
      sharedFile({ fileUri: 'file:///c/f.jpg', fileName: 'f.jpg', fileMime: 'image/jpeg', fileSize: String(25 * MB) }, limits)
        .problem,
    ).toBeNull();
    expect(
      sharedFile({ fileUri: 'file:///c/a.pdf', fileName: 'a.pdf', fileMime: 'application/pdf', fileSize: String(12 * MB) }, limits)
        .problem,
    ).toBe('tooBig');
  });
  it('o que o aparelho nem copiou: grande demais ou ilegível', () => {
    expect(sharedFile({ fileName: 'v.jpg', fileMime: 'image/jpeg', fileSize: String(80 * MB) }, limits).problem).toBe('tooBig');
    expect(sharedFile({ fileName: 'x.png', fileMime: 'image/png' }, limits).problem).toBe('unreadable');
  });
  it('outro tipo de arquivo é recusado', () => {
    expect(sharedFile({ fileUri: 'file:///c/v.mp4', fileName: 'v.mp4', fileMime: 'video/mp4' }, limits).problem).toBe('type');
  });
  it('o título vem do nome sem a extensão', () => {
    expect(fileTitle('Nota fiscal março.pdf')).toBe('Nota fiscal março');
    expect(fileTitle('.pdf')).toBe('.pdf');
  });
});
