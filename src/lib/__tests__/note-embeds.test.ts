import { describe, expect, it } from '@jest/globals';

import {
  embedTarget,
  extractEmbeds,
  noteSection,
  previewLines,
  splitEmbedMarks,
} from '../note-embeds';
import { parseLinks } from '../wikilinks';

const ID = '01a15928-6fcd-7b98-8a1c-a7434f2a328a';

describe('incorporar (OB6)', () => {
  it('troca só as linhas que são um ![[...]] sozinho, fora do código', () => {
    const text = [
      'Antes',
      `![[Receita|n:${ID}]]`,
      `texto ![[Inline|n:${ID}]] no meio`,
      '```',
      '![[Dentro do código]]',
      '```',
      '  ![[foto.png]]  ',
      '[[Só link]]',
    ].join('\n');
    const { text: out, embeds } = extractEmbeds(text);
    expect(embeds.map((e) => e.title)).toEqual(['Receita', 'foto.png']);
    expect(out.split('\n')[1]).toBe('%%questlist-embed:0%%');
    expect(out.split('\n')[6]).toBe('%%questlist-embed:1%%');
    expect(out).toContain('texto ![[Inline');
    expect(out).toContain('![[Dentro do código]]');
  });

  it('separa o texto nas marcas', () => {
    const { text } = extractEmbeds(`# A\n![[x.png]]\n\nfim`);
    expect(splitEmbedMarks(text)).toEqual([
      { kind: 'markdown', text: '# A' },
      { kind: 'embed', index: 0 },
      { kind: 'markdown', text: '\nfim' },
    ]);
    expect(splitEmbedMarks('nada')).toEqual([{ kind: 'markdown', text: 'nada' }]);
  });

  it('o que cada um incorpora', () => {
    const [note, page, image, missing] = parseLinks(
      `![[A|n:${ID}]] ![[L|p:${ID}]] ![[Foto da obra.JPG]] ![[Ideia]]`,
    );
    expect(embedTarget(note)).toEqual({ kind: 'note', id: ID });
    expect(embedTarget(page)).toEqual({ kind: 'page', id: ID });
    expect(embedTarget(image)).toEqual({ kind: 'image', name: 'Foto da obra.JPG' });
    expect(embedTarget(missing)).toEqual({ kind: 'missing' });
  });

  it('o trecho embaixo de um título', () => {
    const body = '# Viagem\nintro\n## Mala\n- meia\n### Roupas\n- casaco\n## Volta\nfim';
    expect(noteSection(body, 'mala')).toBe('## Mala\n- meia\n### Roupas\n- casaco');
    expect(noteSection(body, 'Volta')).toBe('## Volta\nfim');
    expect(noteSection(body, 'nenhum')).toBe(body);
    expect(noteSection(body, null)).toBe(body);
    expect(noteSection('```\n# Mala\n```\n# Mala\nok', 'Mala')).toBe('# Mala\nok');
  });

  it('prévia: as primeiras linhas com texto, sem código', () => {
    expect(previewLines('\n# T\n\n```\ncodigo\n```\na\nb\nc', 3)).toBe('# T\na\nb');
  });
});
