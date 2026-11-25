// Webhook de saída das automações (ESCOPO_V14 §7.1, AU8, D339). Sem imports: roda no Node (testes) e
// no Deno (Edge Function `automation-run`, que faz a conexão de verdade).
//
// Anti-SSRF: só https; o nome é resolvido aqui, TODOS os endereços precisam ser públicos (um só
// interno recusa: contra DNS rebinding com respostas misturadas) e a conexão é feita no IP já
// validado (o nome vai só para o TLS). Redirecionamento não é seguido. Até 10 s, resposta lida até
// 64 KB e só 2 KB vão para o histórico. Assinatura `X-Questlist-Signature: t=<s>,v1=<hmac>`.

export const TEMPO_MS = 10_000;
export const MAX_RESPOSTA = 64 * 1024;
export const MAX_HISTORICO = 2048;
export const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

// ---------------------------------------------------------------------------------------------
// Endereços
// ---------------------------------------------------------------------------------------------

function ipv4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n <= 255) ? p : null;
}

/** IPv6 em 8 grupos de 16 bits (aceita `::` e o final IPv4 `::ffff:1.2.3.4`). */
function ipv6(ip: string): number[] | null {
  let s = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (v4) {
    const p = ipv4(v4[1]);
    if (!p) return null;
    s =
      s.slice(0, -v4[1].length) +
      `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) ?? []).length > 1) return null;
  const [a, b] = s.split('::');
  const head = a ? a.split(':') : [];
  const tail = b !== undefined ? (b ? b.split(':') : []) : null;
  const groups =
    tail === null ? head : [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => g === '' || g.length > 4)) return null;
  return groups.map((g) => parseInt(g, 16));
}

const naFaixa = (p: number[], base: number[], bits: number) => {
  for (let i = 0; i < base.length && bits > 0; i++, bits -= 8) {
    const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
    if ((p[i] & mask) !== (base[i] & mask)) return false;
  }
  return true;
};

/** Faixas IPv4 que não podem receber chamada do servidor. */
const V4_BLOQUEADAS: [number[], number][] = [
  [[0, 0, 0, 0], 8], // "esta rede"
  [[10, 0, 0, 0], 8], // privada
  [[100, 64, 0, 0], 10], // CGNAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local (e os metadados de nuvem, 169.254.169.254)
  [[172, 16, 0, 0], 12], // privada
  [[192, 0, 0, 0], 24], // IETF
  [[192, 0, 2, 0], 24], // documentação
  [[192, 88, 99, 0], 24], // 6to4 relay
  [[192, 168, 0, 0], 16], // privada
  [[198, 18, 0, 0], 15], // testes de desempenho
  [[198, 51, 100, 0], 24], // documentação
  [[203, 0, 113, 0], 24], // documentação
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reservada e broadcast
];

/** O endereço não pode receber chamada do servidor (interno, reservado ou de metadados). */
export function ipBloqueado(ip: string): boolean {
  const v4 = ipv4(ip);
  if (v4) return V4_BLOQUEADAS.some(([base, bits]) => naFaixa(v4, base, bits));
  const g = ipv6(ip);
  if (!g) return true; // o que não se entende, não passa
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  // IPv4 mapeado (::ffff:a.b.c.d) e compatível (::a.b.c.d): vale a regra do IPv4
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return ipBloqueado(`${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) return true; // NAT64 (pode apontar para dentro)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 (site-local antigo)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentação
  if (g[0] === 0x2002) return true; // 6to4 (embute um IPv4 qualquer)
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  return false;
}

export type Destino = { host: string; porta: number; caminho: string; ipLiteral: boolean };

/** Confere o endereço antes de resolver: https, sem usuário e senha, porta válida. */
export function validarUrl(url: string): Destino | { erro: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { erro: 'Endereço inválido' };
  }
  if (u.protocol !== 'https:') return { erro: 'Só endereços https://' };
  if (u.username || u.password) return { erro: 'O endereço não pode ter usuário e senha' };
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) return { erro: 'Endereço sem servidor' };
  const porta = u.port ? Number(u.port) : 443;
  const ipLiteral = ipv4(host) !== null || host.includes(':');
  if (ipLiteral && ipBloqueado(host)) return { erro: `Endereço interno bloqueado: ${host}` };
  if (!ipLiteral && /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i.test(host)) {
    return { erro: `Endereço interno bloqueado: ${host}` };
  }
  return { host, porta, caminho: `${u.pathname || '/'}${u.search}`, ipLiteral };
}

/**
 * Resolve o nome e devolve o IP em que conectar. Um endereço interno entre as respostas já recusa
 * (o DNS pode alternar entre um público e um interno a cada consulta).
 */
export async function destinoSeguro(
  destino: Destino,
  resolver: (host: string) => Promise<string[]>,
): Promise<{ ip: string } | { erro: string }> {
  if (destino.ipLiteral) return { ip: destino.host };
  let ips: string[];
  try {
    ips = await resolver(destino.host);
  } catch {
    return { erro: `Não achei o servidor ${destino.host}` };
  }
  if (ips.length === 0) return { erro: `Não achei o servidor ${destino.host}` };
  const ruim = ips.find(ipBloqueado);
  if (ruim) return { erro: `Endereço interno bloqueado: ${destino.host} aponta para ${ruim}` };
  return { ip: ips[0] };
}

// ---------------------------------------------------------------------------------------------
// Pedido e resposta
// ---------------------------------------------------------------------------------------------

/** Cabeçalhos que a pessoa não escreve (o executor cuida deles). */
export function cabecalhoProibido(nome: string): boolean {
  return /^(host|content-length|connection|transfer-encoding|x-questlist-.*)$/i.test(nome.trim());
}

export type Pedido = {
  metodo: string;
  url: string;
  cabecalhos: Record<string, string>;
  corpo: string | null;
};

/** Monta o HTTP/1.1 do pedido (a conexão é no IP; o Host é o nome). */
export function montarPedido(p: Pedido, destino: Destino): string {
  const host = destino.porta === 443 ? destino.host : `${destino.host}:${destino.porta}`;
  const linhas = [
    `${p.metodo} ${destino.caminho} HTTP/1.1`,
    `Host: ${destino.host.includes(':') ? `[${host}]` : host}`,
    'User-Agent: Questlist-Automacoes/1',
    'Connection: close',
    'Accept: */*',
  ];
  for (const [k, v] of Object.entries(p.cabecalhos)) {
    // Quebra de linha em cabeçalho injetaria outro pedido
    if (/[\r\n]/.test(k) || /[\r\n]/.test(v)) continue;
    linhas.push(`${k}: ${v}`);
  }
  if (p.corpo !== null) {
    linhas.push(`Content-Length: ${new TextEncoder().encode(p.corpo).length}`);
  }
  return `${linhas.join('\r\n')}\r\n\r\n${p.corpo ?? ''}`;
}

export type Resposta = { status: number; cabecalhos: Record<string, string>; corpo: string };

/** Lê a resposta crua (status, cabeçalhos e corpo, com `chunked`). */
export function lerResposta(bytes: Uint8Array): Resposta | null {
  const texto = new TextDecoder().decode(bytes);
  const fim = texto.indexOf('\r\n\r\n');
  if (fim < 0) return null;
  const [linha, ...resto] = texto.slice(0, fim).split('\r\n');
  const m = /^HTTP\/\d(?:\.\d)? (\d{3})/.exec(linha);
  if (!m) return null;
  const cabecalhos: Record<string, string> = {};
  for (const l of resto) {
    const i = l.indexOf(':');
    if (i > 0) cabecalhos[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  }
  let corpo = texto.slice(fim + 4);
  if (/chunked/i.test(cabecalhos['transfer-encoding'] ?? '')) {
    let out = '';
    let i = 0;
    while (i < corpo.length) {
      const nl = corpo.indexOf('\r\n', i);
      if (nl < 0) break;
      const n = parseInt(corpo.slice(i, nl), 16);
      if (!Number.isFinite(n) || n === 0) break;
      out += corpo.slice(nl + 2, nl + 2 + n);
      i = nl + 2 + n + 2;
    }
    corpo = out;
  }
  return { status: Number(m[1]), cabecalhos, corpo };
}

/** O que a resposta vira na execução: 2xx ok, 5xx e 429 tenta de novo, o resto falha. */
export function classificar(
  r: Resposta,
): { ok: true; resultado: unknown } | { tentar: string } | { erro: string } {
  const trecho = r.corpo.slice(0, MAX_HISTORICO);
  if (r.status >= 200 && r.status < 300)
    return { ok: true, resultado: { status: r.status, corpo: trecho } };
  if (r.status >= 300 && r.status < 400) {
    return { erro: `O destino redirecionou (HTTP ${r.status}); redirecionamento não é seguido` };
  }
  if (r.status === 429 || r.status >= 500) return { tentar: `HTTP ${r.status}` };
  return { erro: `HTTP ${r.status}: ${trecho.slice(0, 200)}` };
}

/** Texto assinado: `t.corpo`; o cabeçalho leva `t=<segundos>,v1=<hex>`. */
export const textoAssinado = (t: number, corpo: string) => `${t}.${corpo}`;

export async function hmacHex(segredo: string, texto: string): Promise<string> {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    'raw',
    enc.encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(texto)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function assinatura(segredo: string, corpo: string, agoraMs: number): Promise<string> {
  const t = Math.floor(agoraMs / 1000);
  return `t=${t},v1=${await hmacHex(segredo, textoAssinado(t, corpo))}`;
}

// ---------------------------------------------------------------------------------------------
// O envio inteiro, com a conexão injetada (o Deno conecta; os testes usam uma de mentira)
// ---------------------------------------------------------------------------------------------

export type Conexao = (
  ip: string,
  porta: number,
  host: string,
  dados: string,
) => Promise<Uint8Array>;

export type EfeitoWebhook = {
  url: string;
  metodo?: string;
  cabecalhos?: Record<string, string | { segredo: string }>;
  corpo?: string | null;
  assinar?: boolean;
};

export async function enviarWebhook(
  efeito: EfeitoWebhook,
  chave: string,
  segredos: Record<string, string>,
  deps: { resolver: (host: string) => Promise<string[]>; conectar: Conexao; agora?: () => number },
): Promise<{ ok: true; resultado: unknown } | { tentar: string } | { erro: string }> {
  const destino = validarUrl(efeito.url);
  if ('erro' in destino) return destino;
  const metodo = (efeito.metodo ?? 'POST').toUpperCase();
  if (!(METODOS as readonly string[]).includes(metodo))
    return { erro: `Método não permitido: ${metodo}` };
  const cabecalhos: Record<string, string> = {};
  for (const [k, v] of Object.entries(efeito.cabecalhos ?? {})) {
    if (cabecalhoProibido(k)) continue;
    if (typeof v === 'string') cabecalhos[k] = v;
    else if (v && typeof v.segredo === 'string') {
      const s = segredos[v.segredo];
      if (s === undefined) return { erro: `Segredo "${v.segredo}" não cadastrado` };
      cabecalhos[k] = s;
    }
  }
  const corpo = metodo === 'GET' ? null : (efeito.corpo ?? '');
  if (corpo !== null && !Object.keys(cabecalhos).some((k) => k.toLowerCase() === 'content-type')) {
    cabecalhos['Content-Type'] = 'application/json';
  }
  cabecalhos['X-Questlist-Idempotency'] = chave;
  if (efeito.assinar) {
    const segredo = segredos._assinatura;
    if (!segredo) return { erro: 'A automação ainda não tem segredo de assinatura' };
    cabecalhos['X-Questlist-Signature'] = await assinatura(
      segredo,
      corpo ?? '',
      (deps.agora ?? Date.now)(),
    );
  }
  const alvo = await destinoSeguro(destino, deps.resolver);
  if ('erro' in alvo) return alvo;
  let bytes: Uint8Array;
  try {
    bytes = await deps.conectar(
      alvo.ip,
      destino.porta,
      destino.host,
      montarPedido({ metodo, url: efeito.url, cabecalhos, corpo }, destino),
    );
  } catch (e) {
    return { tentar: e instanceof Error ? e.message : String(e) };
  }
  const resposta = lerResposta(bytes.slice(0, MAX_RESPOSTA));
  if (!resposta) return { tentar: 'Resposta inválida do destino' };
  return classificar(resposta);
}
