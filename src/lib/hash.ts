import * as Crypto from 'expo-crypto';

/** SHA-256 em hexadecimal (o mesmo do `encode(sha256(convert_to(x, 'UTF8')), 'hex')` do Postgres). */
export function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
