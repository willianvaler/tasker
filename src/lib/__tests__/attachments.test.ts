import { describe, expect, it } from '@jest/globals';

import {
  attachmentPaths,
  cleanName,
  extensionOf,
  fitWithin,
  formatBytes,
  isCompressibleImage,
} from '../attachments';

describe('anexos', () => {
  it('reduz só imagens comuns', () => {
    expect(isCompressibleImage('image/jpeg')).toBe(true);
    expect(isCompressibleImage('image/png')).toBe(true);
    expect(isCompressibleImage('image/gif')).toBe(false);
    expect(isCompressibleImage('application/pdf')).toBe(false);
    expect(isCompressibleImage(null)).toBe(false);
  });

  it('extensão pelo nome ou pelo tipo', () => {
    expect(extensionOf('Orçamento.PDF')).toBe('pdf');
    expect(extensionOf('foto', 'image/jpeg')).toBe('jpeg');
    expect(extensionOf('sem nada')).toBe('bin');
  });

  it('caminho com a tarefa na segunda parte (a RLS do Storage depende disso)', () => {
    expect(attachmentPaths('p', 't', 'a', 'webp')).toEqual({
      path: 'p/t/a.webp',
      thumbPath: 'p/t/a.thumb.webp',
    });
  });

  it('cabe no quadrado sem aumentar', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(1000, 3000, 400)).toEqual({ width: 133, height: 400 });
    expect(fitWithin(300, 200, 400)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(0, 0, 400)).toBeNull();
  });

  it('tamanho legível', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(820 * 1024)).toBe('820 KB');
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3,4 MB');
    expect(formatBytes(3.4 * 1024 * 1024, 'en')).toBe('3.4 MB');
  });

  it('nome sem caminho', () => {
    expect(cleanName('C:\\fotos\\parede.jpg', 'x')).toBe('parede.jpg');
    expect(cleanName('', 'Foto')).toBe('Foto');
  });
});
