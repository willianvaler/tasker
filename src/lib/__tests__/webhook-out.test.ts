import { describe, expect, test } from '@jest/globals';

import {
  assinatura,
  classificar,
  destinoSeguro,
  enviarWebhook,
  hmacHex,
  ipBloqueado,
  lerResposta,
  montarPedido,
  validarUrl,
  type Destino,
} from '../../../supabase/functions/_shared/webhook-out';
import { compile, advance, registroBase } from '@/lib/automation/registry';

// Sem @types/node no projeto: o Jest roda no Node, então o require existe
declare const require: (id: string) => unknown;

describe('anti-SSRF (V14 §7.1 e §11)', () => {
  test.each([
    '127.0.0.1',
    '127.1.2.3',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.106',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.254',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'febf::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:192.168.1.1',
    '::ffff:a9fe:a9fe',
    '64:ff9b::a00:1',
    '2002:c0a8:101::1',
    'ff02::1',
    'nao-e-ip',
  ])('%s é bloqueado', (ip) => expect(ipBloqueado(ip)).toBe(true));

  test.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '100.128.0.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
  ])('%s passa', (ip) => expect(ipBloqueado(ip)).toBe(false));

  test.each([
    ['http://exemplo.com/x', 'Só endereços https://'],
    ['https://user:senha@exemplo.com/', 'O endereço não pode ter usuário e senha'],
    ['https://127.0.0.1/admin', 'Endereço interno bloqueado: 127.0.0.1'],
    ['https://[::1]:8443/', 'Endereço interno bloqueado: ::1'],
    ['https://169.254.169.254/latest/meta-data', 'Endereço interno bloqueado: 169.254.169.254'],
    ['https://localhost/', 'Endereço interno bloqueado: localhost'],
    ['https://impressora.local/', 'Endereço interno bloqueado: impressora.local'],
    ['ftp://x', 'Só endereços https://'],
  ])('%s é recusado com mensagem clara', (url, erro) => expect(validarUrl(url)).toEqual({ erro }));

  test('nome que resolve para dentro é recusado', async () => {
    const d = validarUrl('https://interno.exemplo.com/x') as Destino;
    expect(await destinoSeguro(d, async () => ['10.1.2.3'])).toEqual({
      erro: 'Endereço interno bloqueado: interno.exemplo.com aponta para 10.1.2.3',
    });
  });

  test('DNS rebinding: um endereço interno entre as respostas já recusa', async () => {
    const d = validarUrl('https://troca.exemplo.com/') as Destino;
    expect(await destinoSeguro(d, async () => ['93.184.216.34', '127.0.0.1'])).toMatchObject({
      erro: expect.stringMatching(/127\.0\.0\.1/),
    });
  });

  test('conecta no IP validado, não no nome (o DNS não é consultado de novo)', async () => {
    const consultas: string[] = [];
    const conexoes: string[] = [];
    const res = await enviarWebhook(
      { url: 'https://hooks.exemplo.com/a?b=1', metodo: 'POST', corpo: '{"x":1}' },
      'run:0',
      {},
      {
        resolver: async (h) => (consultas.push(h), ['93.184.216.34']),
        conectar: async (ip, porta, host, dados) => {
          conexoes.push(`${ip}:${porta}:${host}`);
          expect(dados).toMatch(/^POST \/a\?b=1 HTTP\/1\.1\r\nHost: hooks\.exemplo\.com\r\n/);
          return new TextEncoder().encode('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok');
        },
      },
    );
    expect(res).toEqual({ ok: true, resultado: { status: 200, corpo: 'ok' } });
    expect(consultas).toEqual(['hooks.exemplo.com']);
    expect(conexoes).toEqual(['93.184.216.34:443:hooks.exemplo.com']);
  });

  test('redirecionamento não é seguido (nem para IP interno)', () => {
    const r = lerResposta(
      new TextEncoder().encode('HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1/\r\n\r\n'),
    );
    expect(r && classificar(r)).toEqual({
      erro: 'O destino redirecionou (HTTP 302); redirecionamento não é seguido',
    });
  });
});

describe('pedido, resposta e assinatura', () => {
  test('cabeçalhos proibidos e quebra de linha não entram; Content-Length certo com acento', () => {
    const d = validarUrl('https://exemplo.com:8443/x') as Destino;
    const texto = montarPedido(
      {
        metodo: 'POST',
        url: '',
        cabecalhos: { 'X-Bom': 'sim', 'X-Ruim': 'a\r\nHost: outro' },
        corpo: 'ação',
      },
      d,
    );
    expect(texto).toContain('Host: exemplo.com:8443\r\n');
    expect(texto).toContain('X-Bom: sim');
    expect(texto).not.toContain('X-Ruim');
    expect(texto).toContain('Content-Length: 6\r\n');
  });

  test('resposta em chunked', () => {
    const r = lerResposta(
      new TextEncoder().encode(
        'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n',
      ),
    );
    expect(r?.corpo).toBe('Wikipedia');
  });

  test.each([
    [500, 'tentar'],
    [503, 'tentar'],
    [429, 'tentar'],
    [404, 'erro'],
    [401, 'erro'],
    [204, 'ok'],
  ])('HTTP %i → %s', (status, tipo) => {
    expect(Object.keys(classificar({ status, cabecalhos: {}, corpo: '' }))[0]).toBe(tipo);
  });

  test('histórico guarda só 2 KB da resposta', () => {
    const r = classificar({ status: 200, cabecalhos: {}, corpo: 'x'.repeat(5000) }) as {
      resultado: { corpo: string };
    };
    expect(r.resultado.corpo).toHaveLength(2048);
  });

  test('assinatura confere com o HMAC-SHA256 do Node (o exemplo da Ajuda)', async () => {
    const { createHmac } = require('crypto') as {
      createHmac: (
        a: string,
        k: string,
      ) => { update: (s: string) => { digest: (e: string) => string } };
    };
    const header = await assinatura('segredo', '{"a":1}', 1_700_000_000_000);
    const esperado = createHmac('sha256', 'segredo').update('1700000000.{"a":1}').digest('hex');
    expect(header).toBe(`t=1700000000,v1=${esperado}`);
    expect(await hmacHex('k', 'm')).toBe(createHmac('sha256', 'k').update('m').digest('hex'));
  });

  test('segredo de cabeçalho vai no pedido e nunca no resultado', async () => {
    let enviado = '';
    const res = await enviarWebhook(
      {
        url: 'https://exemplo.com/',
        cabecalhos: { Authorization: { segredo: 'token' } },
        corpo: '{}',
        assinar: true,
      },
      'r:1',
      { token: 'Bearer abc123', _assinatura: 's' },
      {
        resolver: async () => ['93.184.216.34'],
        conectar: async (_ip, _p, _h, dados) => (
          (enviado = dados),
          new TextEncoder().encode('HTTP/1.1 200 OK\r\n\r\n')
        ),
      },
    );
    expect(enviado).toContain('Authorization: Bearer abc123');
    expect(enviado).toMatch(/X-Questlist-Signature: t=\d+,v1=[0-9a-f]{64}/);
    expect(enviado).toContain('X-Questlist-Idempotency: r:1');
    expect(JSON.stringify(res)).not.toContain('abc123');
  });

  test('segredo que não existe falha sem chamar', async () => {
    const res = await enviarWebhook(
      { url: 'https://exemplo.com/', cabecalhos: { Authorization: { segredo: 'nada' } } },
      'r:1',
      {},
      {
        resolver: async () => ['93.184.216.34'],
        conectar: async () => {
          throw new Error('não devia conectar');
        },
      },
    );
    expect(res).toEqual({ erro: 'Segredo "nada" não cadastrado' });
  });
});

describe('passo enviar_webhook', () => {
  test('monta o corpo JSON com o texto expandido e escapado', () => {
    const reg = registroBase();
    const a = advance(
      compile(
        [
          {
            tipo: 'enviar_webhook',
            url: 'https://discord.com/api/webhooks/1/x',
            corpo: { content: 'Nível {{evento.nivel}}: "{{evento.titulo}}"' },
          },
        ],
        reg,
      ),
      0,
      {
        estado: { evento: { nivel: 7, titulo: 'a"b' }, var: {} },
        escopo: 'pessoal',
        regra: { id: 'r', nome: 'R' },
        agora: '2026-11-24T12:00:00Z',
      },
      reg,
    );
    expect(a.externo).toBe(true);
    expect(a.efeito).toMatchObject({
      tipo: 'webhook',
      metodo: 'POST',
    });
    expect(JSON.parse((a.efeito as { corpo: string }).corpo)).toEqual({
      content: 'Nível 7: "a"b"',
    });
  });
});
