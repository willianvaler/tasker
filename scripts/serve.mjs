// Servidor da versão web para acesso remoto (túnel da Cloudflare): entrega o build em dist/ com
// fallback de SPA e repassa /supabase/* (HTTP e websocket do Realtime) para o Supabase local e
// /powersync/* para o serviço de sync.
//   npm run deploy (gera dist-remote/ e reinicia o serviço) · PORT=8787 node scripts/serve.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = process.env.DIST ?? join(import.meta.dirname, '..', 'dist-remote');
const UPSTREAMS = {
  '/supabase': { host: '127.0.0.1', port: 54321, down: 'Supabase local fora do ar (npm run db:start)' },
  '/powersync': { host: '127.0.0.1', port: 8095, down: 'PowerSync fora do ar (npm run sync:start)' },
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
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
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

const server = http.createServer((req, res) => {
  const target = upstreamFor(req.url);
  if (target) proxy(target, req, res);
  else serveFile(req, res);
});

// Websocket (Realtime, sync): repassa o pedido de upgrade e depois só copia os bytes
server.on('upgrade', (req, socket, head) => {
  const target = upstreamFor(req.url);
  if (!target) return socket.destroy();
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
