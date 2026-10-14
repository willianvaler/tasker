import { getRandomBytes } from 'expo-crypto';

// UUID v7: os 48 primeiros bits são o horário em ms, então os ids criados no aparelho (inclusive
// offline) saem em ordem de criação e o índice do banco cresce no fim, não espalhado
export function uuidv7(now = Date.now(), random: Uint8Array = getRandomBytes(16)): string {
  const b = Uint8Array.from(random);
  for (let i = 0; i < 6; i++) b[i] = Math.floor(now / 2 ** (8 * (5 - i))) % 256;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
