import { describe, expect, test } from '@jest/globals';

import { clipNote, decodeClip, encodeClip } from '../clip';

describe('Web Clipper (OB15)', () => {
  test('vai e volta pelo endereço, com acento e emoji', () => {
    const fragment = encodeClip({
      title: 'Pão de queijo 🧀',
      url: 'https://exemplo.com/pao?x=1',
      markdown: '# Pão\n\n- polvilho',
      author: 'Ana',
      published: '2026-10-30T12:00:00Z',
      selection: true,
    });
    expect(fragment).toMatch(/^[\w-]+$/);
    expect(decodeClip(`#${fragment}`)).toEqual({
      title: 'Pão de queijo 🧀',
      url: 'https://exemplo.com/pao?x=1',
      markdown: '# Pão\n\n- polvilho',
      author: 'Ana',
      description: null,
      published: '2026-10-30',
      selection: true,
    });
  });

  test('endereço que não é http(s) não entra; sem título, vale o site', () => {
    const clip = decodeClip(encodeClip({ url: 'javascript:alert(1)', markdown: 'x' }));
    expect(clip).toMatchObject({ url: null, title: '' });
    expect(decodeClip(encodeClip({ url: 'https://www.site.com/a' }))?.title).toBe('www.site.com');
  });

  test('lixo, vazio ou JSON que não é recorte: nada', () => {
    expect(decodeClip('')).toBeNull();
    expect(decodeClip('%%%')).toBeNull();
    expect(decodeClip(encodeClip({}))).toBeNull();
    expect(decodeClip(encodeClip({ published: 'ontem', title: 'a' }))?.published).toBeNull();
  });

  test('anotação: propriedades da origem e a etiqueta de recortes', () => {
    const note = clipNote(
      {
        title: 'Artigo',
        url: 'https://x.com/a',
        markdown: '\nTexto\n',
        author: 'Bia',
        published: '2026-01-02',
      },
      { today: '2026-11-04', tag: 'recortes' },
    );
    expect(note).toEqual({
      title: 'Artigo',
      body: 'Texto',
      props: {
        source: 'https://x.com/a',
        author: 'Bia',
        published: '2026-01-02',
        created: '2026-11-04',
        tags: ['recortes'],
      },
    });
  });

  test('sem texto (só o link do Compartilhar), o corpo é o link', () => {
    const note = clipNote(
      { title: 'Site', url: 'https://x.com/', markdown: '' },
      { today: '2026-11-04', tag: 'clippings' },
    );
    expect(note.body).toBe('<https://x.com/>');
  });
});
