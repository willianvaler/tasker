// Servidor da versão web para acesso remoto (túnel da Cloudflare): entrega o build em dist/ com
// fallback de SPA e repassa /supabase/* (HTTP e websocket do Realtime) para o Supabase local e
// /powersync/* para o serviço de sync. /calendario/<token>.ics é o feed do calendário (C1).
//   npm run deploy (gera dist-remote/ e reinicia o serviço) · PORT=8081 node scripts/serve.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { extname, join, normalize } from 'node:path';

import { checkSupabase, PUBLISHABLE } from './supabase-gate.mjs';

// Portas do ambiente (D178): a produção usa os padrões; alpha e lab trocam pelo .ambiente.local
const PORT = Number(process.env.PORT ?? process.env.WEB_PORT ?? 8081);
const DIST = process.env.DIST ?? join(import.meta.dirname, '..', 'dist-remote');
// APK do Android (npm run apk, U7): fica fora do dist-remote, que o deploy apaga
const DOWNLOADS = join(import.meta.dirname, '..', 'downloads');
const UPSTREAMS = {
  '/supabase': {
    host: '127.0.0.1',
    port: Number(process.env.SUPABASE_API_PORT ?? 54321),
    down: 'Supabase local fora do ar (npm run db:start)',
  },
  '/powersync': {
    host: '127.0.0.1',
    port: Number(process.env.POWERSYNC_PORT ?? 8095),
    down: 'PowerSync fora do ar (npm run sync:start)',
  },
};
const upstreamFor = (url) => {
  const prefix = Object.keys(UPSTREAMS).find((p) => url.startsWith(p + '/'));
  return prefix && { prefix, ...UPSTREAMS[prefix] };
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

function serveFile(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory())
    file = join(DIST, 'index.html');
  const hashed = /\/_expo\/|\/assets\//.test(path);
  res.writeHead(200, {
    ...securityHeaders(req),
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

// Segurança (W9): quem chega pela Cloudflare em http:// vai para https://, e as respostas do app
// levam os cabeçalhos de proteção. HSTS só quando a visita veio por HTTPS (nunca no localhost).
const viaHttp = (req) =>
  req.headers['x-forwarded-proto'] === 'http' ||
  /"scheme":"http"/.test(req.headers['cf-visitor'] ?? '');
const viaHttps = (req) =>
  req.headers['x-forwarded-proto'] === 'https' ||
  /"scheme":"https"/.test(req.headers['cf-visitor'] ?? '');
function securityHeaders(req) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
    ...(viaHttps(req) && { 'Strict-Transport-Security': 'max-age=15552000' }),
  };
}

/** /downloads/questlist.apk e /downloads/apk.json (ou 404, sem cair no index.html) */
function serveDownload(req, res) {
  const name = new URL(req.url, 'http://x').pathname.slice('/downloads/'.length);
  const file = join(DOWNLOADS, name);
  if (!/^[\w.-]+$/.test(name) || !existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Ainda não há APK publicado (npm run apk).');
  }
  const apk = name.endsWith('.apk');
  res.writeHead(200, {
    ...securityHeaders(req),
    'Content-Type': apk ? 'application/vnd.android.package-archive' : 'application/json',
    'Content-Length': statSync(file).size,
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    ...(apk && { 'Content-Disposition': 'attachment; filename="questlist.apk"' }),
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

/**
 * Feed do calendário (C1): /calendario/<token>.ics, assinado por URL no Google Agenda, no Apple e no
 * Outlook. Vem sem login; o banco monta o .ics (calendar_ics) e o token é a única credencial.
 */
async function serveCalendar(req, res) {
  const token = /^\/calendario\/([\w-]{20,64})(?:\.ics)?$/.exec(
    new URL(req.url, 'http://x').pathname,
  )?.[1];
  const notFound = () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Calendário não encontrado (o link pode ter sido trocado).');
  };
  if (!token || !PUBLISHABLE) return notFound();
  const origin = `${viaHttps(req) ? 'https' : 'http'}://${req.headers.host}`;
  try {
    const up = await fetch(
      `http://127.0.0.1:${UPSTREAMS['/supabase'].port}/rest/v1/rpc/calendar_ics`,
      {
        method: 'POST',
        headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token, p_origin: origin }),
      },
    );
    const ics = up.ok ? await up.json() : null;
    // Quem buscou e quantos eventos levou: dá para saber se o Google está vindo (sem o token)
    const events = typeof ics === 'string' ? ics.split('BEGIN:VEVENT').length - 1 : 'nenhum';
    console.log(
      `Calendário ${token.slice(0, 4)}…: ${events} eventos para ${req.headers['user-agent'] ?? '?'}`,
    );
    if (typeof ics !== 'string') return notFound();
    res.writeHead(200, {
      ...securityHeaders(req),
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="questlist.ics"',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : ics);
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(UPSTREAMS['/supabase'].down);
  }
}

function proxy(target, req, res) {
  const upstream = http.request(
    {
      host: target.host,
      port: target.port,
      method: req.method,
      path: req.url.slice(target.prefix.length) || '/',
      headers: { ...req.headers, host: `${target.host}:${target.port}` },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end(target.down);
  });
  req.pipe(upstream);
}

// D175: o /supabase passa pelo portão (rotas, apikey e token); o PowerSync confere o token sozinho
async function guarded(target, req) {
  if (target.prefix !== '/supabase') return null;
  const denied = await checkSupabase(req.url.slice(target.prefix.length) || '/', req.headers).catch(
    () => [500, 'erro no portão'],
  );
  if (denied) {
    const who = req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress;
    console.warn(`Recusado (${denied[1]}): ${req.method} ${req.url.split('?')[0]} de ${who}`);
  }
  return denied;
}

const server = http.createServer((req, res) => {
  // O Google Agenda assina por webcal:// e busca por http://: o feed responde sem redirecionar
  if (viaHttp(req) && req.headers.host && !req.url.startsWith('/calendario/')) {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    return res.end();
  }
  const target = upstreamFor(req.url);
  if (target)
    guarded(target, req).then((denied) => {
      if (!denied) return proxy(target, req, res);
      res.writeHead(denied[0], { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(denied[1]);
    });
  else if (req.url.startsWith('/downloads/')) serveDownload(req, res);
  else if (req.url.startsWith('/calendario/')) void serveCalendar(req, res);
  else serveFile(req, res);
});

// Websocket (Realtime, sync): repassa o pedido de upgrade e depois só copia os bytes
server.on('upgrade', async (req, socket, head) => {
  const target = upstreamFor(req.url);
  if (!target || (await guarded(target, req))) return socket.destroy();
  const upstream = net.connect(target.port, target.host, () => {
    const headers = Object.entries({ ...req.headers, host: `${target.host}:${target.port}` })
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    const path = req.url.slice(target.prefix.length);
    upstream.write(`${req.method} ${path} HTTP/1.1\r\n${headers}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, () => console.log(`Questlist em http://localhost:${PORT}`));
