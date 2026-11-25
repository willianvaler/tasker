// Webhook de entrada das automações (ESCOPO_V14 §7.2, AU9, D340): POST /hooks/<token>.
// Limite de 30 por minuto por token e 120 por IP (rate-limit.mjs), corpo JSON ou formulário até
// 16 KB, e a resposta é sempre 202 sem corpo (token inválido, regra desligada ou assinatura errada
// respondem igual: nada a sondar). Quem decide se vale é o banco (automation_hook_fire).
import { createLimiter } from './rate-limit.mjs';

export const HOOK_PATH = /^\/hooks\/([0-9a-f]{64})\/?$/;
export const MAX_BODY = 16 * 1024;

/** Corpo cru → objeto (JSON ou formulário); null se não der para ler. */
export function parseHookBody(raw, contentType = '') {
  if (raw.trim() === '') return {};
  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : { valor: v };
  } catch {
    return null;
  }
}

/** `fire(token, corpo, cru, assinatura)` chama o banco; o resto é daqui. */
export function createHookHandler({ fire, now } = {}) {
  const byToken = createLimiter({ max: 30, windowMs: 60_000, now });
  const byIp = createLimiter({ max: 120, windowMs: 60_000, now });
  const reply = (res, status, extra = {}) => {
    res.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Length': '0', ...extra });
    res.end();
  };
  return function handle(req, res) {
    const token = HOOK_PATH.exec(new URL(req.url, 'http://x').pathname)?.[1];
    if (req.method !== 'POST') return reply(res, 405, { Allow: 'POST' });
    const who = String(req.headers['cf-connecting-ip'] ?? req.socket?.remoteAddress ?? '?');
    if (!byIp.hit(who) || (token && !byToken.hit(token)))
      return reply(res, 429, { 'Retry-After': '60' });
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > MAX_BODY) {
      req.resume();
      return reply(res, 413);
    }
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) tooBig = true;
      else chunks.push(c);
    });
    req.on('end', async () => {
      if (tooBig) return reply(res, 413);
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = parseHookBody(raw, req.headers['content-type']);
      if (body === null) return reply(res, 400);
      // Token com formato errado nem chega ao banco, mas responde igual
      if (token) {
        try {
          await fire(token, body, raw, req.headers['x-questlist-signature'] ?? null);
        } catch {
          // banco fora: a pessoa que chamou não precisa saber (e não há o que repetir daqui)
        }
      }
      reply(res, 202);
    });
  };
}
