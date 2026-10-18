// Portão do /supabase no endereço público (D175). O Supabase local foi feito para desenvolvimento:
// a chave secreta e o segredo de JWT padrão do CLI são públicos, e rotas como /pg (SQL como
// superusuário) não deveriam sair da máquina. Aqui, antes de repassar:
//   - só passam as rotas que o app usa (auth, rest, realtime, storage), e nunca /auth/v1/admin;
//   - `apikey` (cabeçalho ou ?apikey=) só a publicável;
//   - `Authorization: Bearer` só a publicável ou um login de verdade: JWT ES256 assinado por uma
//     chave do JWKS do Auth local, papel authenticated/anon e dentro da validade.
// Pedido sem apikey nem Bearer passa (links de e-mail, URLs assinadas do Storage): o Supabase decide.
import { Buffer } from 'node:buffer';
import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AUTH = `http://127.0.0.1:${process.env.SUPABASE_API_PORT ?? 54321}/auth/v1/.well-known/jwks.json`;
const ALLOWED = ['/auth/v1/', '/rest/v1/', '/realtime/v1/', '/storage/v1/'];
const BLOCKED = ['/auth/v1/admin'];
const ROLES = new Set(['authenticated', 'anon']);

/** Chave publicável: SUPABASE_PUBLISHABLE_KEY ou a do .env.local do app (não é segredo). */
function publishableKey() {
  if (process.env.SUPABASE_PUBLISHABLE_KEY) return process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    const env = readFileSync(join(import.meta.dirname, '..', '.env.local'), 'utf8');
    return env.match(/^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1].trim();
  } catch {
    return undefined;
  }
}
export const PUBLISHABLE = publishableKey();
if (!PUBLISHABLE)
  console.warn(
    'Portão do Supabase: chave publicável não encontrada; tudo com apikey será recusado',
  );

// JWKS do Auth local em cache; kid desconhecido busca de novo (no máximo a cada 30 s)
let keys = new Map();
let fetchedAt = 0;
async function keyFor(kid) {
  const age = Date.now() - fetchedAt;
  if ((!keys.has(kid) && age > 30_000) || age > 10 * 60_000) {
    try {
      const { keys: list } = await (await fetch(AUTH)).json();
      keys = new Map(
        list
          .filter((k) => k.kty === 'EC' && k.alg === 'ES256')
          .map((k) => [k.kid, createPublicKey({ key: k, format: 'jwk' })]),
      );
      fetchedAt = Date.now();
    } catch {
      // Auth fora do ar: fica com as chaves que já tinha
    }
  }
  return keys.get(kid);
}

const b64 = (part) => Buffer.from(part, 'base64url');
const json = (part) => {
  try {
    return JSON.parse(b64(part).toString('utf8'));
  } catch {
    return null;
  }
};

/** Login válido: ES256 com chave do JWKS, papel de usuário e não vencido. */
async function validUserToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const header = json(parts[0]);
  const payload = json(parts[1]);
  if (header?.alg !== 'ES256' || typeof header.kid !== 'string' || !payload) return false;
  const key = await keyFor(header.kid);
  if (!key) return false;
  const signed = verify(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key, dsaEncoding: 'ieee-p1363' },
    b64(parts[2]),
  );
  return (
    signed &&
    ROLES.has(payload.role) &&
    typeof payload.exp === 'number' &&
    payload.exp * 1000 > Date.now()
  );
}

/**
 * Confere um pedido para o Supabase (`path` já sem o "/supabase").
 * Devolve null se pode passar, ou [status, motivo].
 */
export async function checkSupabase(path, headers) {
  const url = new URL(path, 'http://x');
  const route = url.pathname;
  if (!ALLOWED.some((p) => route.startsWith(p)) || BLOCKED.some((p) => route.startsWith(p)))
    return [404, 'rota fechada'];
  const apikeys = [headers.apikey, url.searchParams.get('apikey')].flat().filter(Boolean);
  if (apikeys.some((k) => k !== PUBLISHABLE)) return [401, 'apikey recusada'];
  const auth = headers.authorization;
  if (auth) {
    const token = /^Bearer (.+)$/i.exec(auth)?.[1]?.trim();
    if (!token) return [401, 'authorization recusada'];
    if (token !== PUBLISHABLE && !(await validUserToken(token))) return [401, 'token recusado'];
  }
  return null;
}
