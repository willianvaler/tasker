/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';

import { base64ToBytes, bytesToBase64 } from '../base64';

describe('base64', () => {
  it('igual ao do Node, ida e volta', () => {
    for (const size of [0, 1, 2, 3, 4, 5, 100, 10_000]) {
      const bytes = new Uint8Array(size).map((_, i) => (i * 37 + size) % 256);
      const text = bytesToBase64(bytes);
      expect(text).toBe(Buffer.from(bytes).toString('base64'));
      expect([...base64ToBytes(text)]).toEqual([...bytes]);
    }
  });
});
