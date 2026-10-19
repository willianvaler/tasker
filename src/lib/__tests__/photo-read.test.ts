import { describe, expect, it } from '@jest/globals';

import { nfceKey, normalizeList, normalizeReceipt, toBase64, toCents } from '../photo-read';

const today = '2026-10-19';

describe('normalizeReceipt', () => {
  it('nota bem lida', () =>
    expect(
      normalizeReceipt(
        {
          readable: true,
          store: '  Leroy   Merlin ',
          date: '2026-10-18',
          total: 1840.5,
          payment_method: 'pix',
          access_key: '3526 1012 3456 7800 0190 6500 1000 0123 4510 0012 3456',
          category: 'material',
          items: [
            { description: 'Piso', amount: 1800 },
            { description: 'Rejunte', amount: '40,50' },
            { description: '', amount: 3 },
          ],
        },
        today,
      ),
    ).toEqual({
      readable: true,
      description: 'Leroy Merlin',
      amount_cents: 184050,
      spent_on: '2026-10-18',
      method: 'pix',
      nfce_key: '35261012345678000190650010000123451000123456',
      category: 'material',
      items: [
        { description: 'Piso', amount_cents: 180000 },
        { description: 'Rejunte', amount_cents: 4050 },
      ],
    }));
  it('sem total, a soma dos itens', () =>
    expect(
      normalizeReceipt(
        {
          store: 'Feira',
          total: null,
          items: [
            { description: 'Maçã', amount: 5 },
            { description: 'Pera', amount: 7.5 },
          ],
        },
        today,
      ).amount_cents,
    ).toBe(1250));
  it('data estranha ou no futuro vira hoje; forma e categoria desconhecidas saem', () =>
    expect(
      normalizeReceipt(
        { store: 'X', total: 10, date: '2027-01-01', payment_method: 'cheque', category: 'luxo' },
        today,
      ),
    ).toMatchObject({ spent_on: today, method: null, category: null }));
  it('foto que não é nota', () =>
    expect(normalizeReceipt({ readable: false, items: [] }, today).readable).toBe(false));
  it('lixo do modelo não quebra', () =>
    expect(normalizeReceipt('oi', today)).toMatchObject({ readable: false, amount_cents: null }));
});

describe('partes', () => {
  it('centavos', () => {
    expect(toCents(12.345)).toBe(1235);
    expect(toCents('0')).toBeNull();
    expect(toCents(-3)).toBeNull();
  });
  it('chave da NFC-e só com 44 dígitos', () => {
    expect(nfceKey('1234')).toBeNull();
    expect(nfceKey('3'.repeat(44))).toBe('3'.repeat(44));
  });
  it('lista: sem marcadores nem números', () =>
    expect(normalizeList({ lines: ['- Supino 3x10', '2) Agachamento', '  ', 'Pão'] })).toEqual([
      'Supino 3x10',
      'Agachamento',
      'Pão',
    ]));
  it('base64', () => {
    const bytes = new TextEncoder().encode('Olá, nota!');
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(toBase64(new Uint8Array([1]))).toBe('AQ==');
    expect(toBase64(new Uint8Array([1, 2]))).toBe('AQI=');
  });
});
