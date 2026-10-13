import { describe, expect, it } from '@jest/globals';

import { resolveLocale } from '../locale';

describe('resolveLocale', () => {
  it('qualquer português vira pt-BR', () => {
    expect(resolveLocale(['pt-BR'])).toBe('pt-BR');
    expect(resolveLocale(['pt-PT'])).toBe('pt-BR');
    expect(resolveLocale(['pt'])).toBe('pt-BR');
  });

  it('inglês e espanhol de qualquer região', () => {
    expect(resolveLocale(['en-GB'])).toBe('en');
    expect(resolveLocale(['es-AR'])).toBe('es');
    expect(resolveLocale(['es_MX'])).toBe('es');
  });

  it('pega o primeiro suportado na ordem do aparelho', () => {
    expect(resolveLocale(['fr-FR', 'es-ES', 'en-US'])).toBe('es');
  });

  it('sem nenhum suportado (ou vazio), pt-BR', () => {
    expect(resolveLocale(['de-DE', null])).toBe('pt-BR');
    expect(resolveLocale([])).toBe('pt-BR');
  });
});
