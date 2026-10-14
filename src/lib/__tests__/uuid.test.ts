import { describe, expect, it } from '@jest/globals';

import { uuidv7 } from '../uuid';

const zeros = new Uint8Array(16);

describe('uuidv7', () => {
  it('tem versão 7 e variante RFC', () => {
    expect(uuidv7(Date.now())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('começa com o horário em ms', () => {
    const ms = Date.UTC(2026, 9, 14, 12, 0, 0);
    const id = uuidv7(ms, zeros);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ms);
    expect(id).toBe(
      `${ms
        .toString(16)
        .padStart(12, '0')
        .replace(/^(.{8})/, '$1-')}-7000-8000-000000000000`,
    );
  });

  it('ids mais novos ordenam depois', () => {
    const a = uuidv7(1_000, new Uint8Array(16).fill(255));
    const b = uuidv7(1_001, zeros);
    expect(a < b).toBe(true);
  });
});
