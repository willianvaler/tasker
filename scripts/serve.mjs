// Servidor da versão web para acesso remoto (túnel da Cloudflare): entrega o build em dist/ com
// fallback de SPA e repassa /supabase/* (HTTP e websocket do Realtime) para o Supabase local.
//   npm run deploy (gera dist-remote/ e reinicia o serviço) · PORT=8787 node scripts/serve.mjs
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = process.env.DIST ?? join(import.meta.dirname, '..', 'dist-remote');
const SUPABASE = { host: '127.0.0.1', port: 54321 };
const PREFIX = '/supabase';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
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

function proxy(req, res) {
  const upstream = http.request(
    {
      ...SUPABASE,
      method: req.method,
      path: req.url.slice(PREFIX.length) || '/',
      headers: { ...req.headers, host: `${SUPABASE.host}:${SUPABASE.port}` },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502);
    res.end('Supabase local fora do ar (npm run db:start)');
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) =>
  req.url.startsWith(PREFIX + '/') ? proxy(req, res) : serveFile(req, res),
);

// Websocket (Realtime): repassa o pedido de upgrade e depois só copia os bytes
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith(PREFIX + '/')) return socket.destroy();
  const upstream = net.connect(SUPABASE.port, SUPABASE.host, () => {
    const headers = Object.entries({ ...req.headers, host: `${SUPABASE.host}:${SUPABASE.port}` })
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    upstream.write(`${req.method} ${req.url.slice(PREFIX.length)} HTTP/1.1\r\n${headers}\r\n\r\n`);
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(PORT, () => console.log(`Questlist em http://localhost:${PORT}`));
