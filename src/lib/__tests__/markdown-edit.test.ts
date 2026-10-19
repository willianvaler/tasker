import { describe, expect, it } from '@jest/globals';

import { applyFormat, plainText, withTaskBoxes } from '../markdown-edit';

describe('applyFormat', () => {
  it('negrito envolve a seleção e desfaz', () => {
    const on = applyFormat('pagar luz', { start: 6, end: 9 }, 'bold');
    expect(on).toEqual({ text: 'pagar **luz**', selection: { start: 8, end: 11 } });
    expect(applyFormat(on.text, on.selection, 'bold')).toEqual({
      text: 'pagar luz',
      selection: { start: 6, end: 9 },
    });
  });

  it('itálico sem seleção deixa o cursor entre as marcas', () => {
    expect(applyFormat('a ', { start: 2, end: 2 }, 'italic')).toEqual({
      text: 'a __',
      selection: { start: 3, end: 3 },
    });
  });

  it('lista marca cada linha selecionada e desmarca', () => {
    const text = 'leite\npão\ncafé';
    const on = applyFormat(text, { start: 0, end: text.length }, 'list');
    expect(on.text).toBe('- leite\n- pão\n- café');
    expect(on.selection).toEqual({ start: 0, end: on.text.length });
    expect(applyFormat(on.text, on.selection, 'list').text).toBe(text);
  });

  it('título e caixinha só na linha do cursor; troca uma marca pela outra', () => {
    const text = 'compras\nleite';
    const heading = applyFormat(text, { start: 3, end: 3 }, 'heading');
    expect(heading).toEqual({ text: '## compras\nleite', selection: { start: 6, end: 6 } });
    const task = applyFormat('- leite', { start: 7, end: 7 }, 'task');
    expect(task.text).toBe('- [ ] leite');
    expect(task.selection).toEqual({ start: 11, end: 11 });
  });

  it('numerada conta as linhas', () => {
    expect(applyFormat('a\nb', { start: 0, end: 3 }, 'numbered').text).toBe('1. a\n2. b');
  });
});

describe('caixinhas e texto puro', () => {
  it('caixinhas viram ☐ e ☑ para mostrar', () => {
    expect(withTaskBoxes('- [ ] leite\n- [x] pão\n- solto')).toBe('- ☐ leite\n- ☑ pão\n- solto');
  });

  it('texto sem marcação para as prévias', () => {
    expect(plainText('## Mercado\n- [ ] **leite**\n1. _pão_\n[site](https://x.org)')).toBe(
      'Mercado\nleite\npão\nsite',
    );
  });
});
