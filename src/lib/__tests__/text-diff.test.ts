import { describe, expect, it } from '@jest/globals';

import { collapseDiff, diffLines, diffStats } from '../text-diff';

describe('diffLines', () => {
  it('iguais: tudo igual', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
    ]);
  });

  it('linha trocada no meio', () => {
    expect(diffLines('a\nb\nc', 'a\nB\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'B' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('linhas que entraram e saíram, mantendo as comuns', () => {
    const d = diffLines('um\ndois\ntrês\nquatro', 'zero\num\ntrês\nquatro\ncinco');
    expect(d.filter((l) => l.type === 'same').map((l) => l.text)).toEqual(['um', 'três', 'quatro']);
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 });
  });

  it('do vazio para algo', () => {
    expect(diffStats(diffLines('', 'a\nb'))).toEqual({ added: 2, removed: 1 });
  });

  it('texto grande demais cai na comparação simples, sem travar', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n');
    expect(diffStats(diffLines(a, b))).toEqual({ added: 3000, removed: 3000 });
  });
});

describe('collapseDiff', () => {
  it('esconde o trecho igual longe das mudanças', () => {
    const before = Array.from({ length: 10 }, (_, i) => `l${i}`).join('\n');
    const after = before.replace('l5', 'L5');
    const chunks = collapseDiff(diffLines(before, after), 1);
    expect(chunks[0]).toEqual({ type: 'skip', count: 4 });
    expect(chunks.at(-1)).toEqual({ type: 'skip', count: 3 });
    expect(chunks.filter((c) => c.type !== 'skip')).toHaveLength(4);
  });

  it('sem mudança, tudo vira um trecho escondido', () => {
    expect(collapseDiff(diffLines('a\nb', 'a\nb'))).toEqual([{ type: 'skip', count: 2 }]);
  });
});
