import { describe, expect, it } from '@jest/globals';

import { imageMarkdown, imagePath, imageRef, noteImageRefs, parseImageRef } from '../note-images';

const note = '0193a0b0-0000-7000-8000-000000000001';
const asset = '0193a0b0-0000-7000-8000-000000000002';

describe('imagens da anotação', () => {
  it('referência, caminho e Markdown', () => {
    const ref = imageRef(note, asset, 'WEBP');
    expect(ref).toBe(`${note}/${asset}.webp`);
    expect(imagePath(ref)).toBe(`notes/${note}/${asset}.webp`);
    expect(imageMarkdown('Na [figura]', ref)).toBe(`![Na figura](qlimg:${ref})`);
  });
  it('só aceita a referência no formato do app', () => {
    expect(parseImageRef(`qlimg:${note}/${asset}.png`)).toBe(`${note}/${asset}.png`);
    expect(parseImageRef('qlimg:../../segredo.png')).toBeNull();
    expect(parseImageRef('https://x/a.png')).toBeNull();
  });
  it('acha as imagens citadas no texto, sem repetir', () => {
    const ref = imageRef(note, asset, 'png');
    expect(noteImageRefs(`a ![x](qlimg:${ref}) b ![y](qlimg:${ref}) ![z](qlimg:lixo)`)).toEqual([
      ref,
    ]);
  });
});
