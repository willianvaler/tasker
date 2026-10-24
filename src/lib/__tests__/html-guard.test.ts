import { expect, it } from '@jest/globals';

import { guardHtml } from '../html-guard';

const html = (status: number) =>
  new Response('<html><body>Bloqueado pelo proxy</body></html>', {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
const API = 'https://x/supabase/rest/v1/rpc/grant_sensitive_consent';

it.each([403, 200, 502])('HTML %i da API vira erro 502 em JSON, sem o HTML', async (status) => {
  const res = guardHtml(html(status), API);
  expect(res.status).toBe(502);
  const body = (await res.json()) as { message: string; code: string };
  expect(body.code).toBe('html_response');
  expect(body.message).not.toMatch(/</);
});

it('resposta em JSON passa igual', () => {
  const res = new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
  expect(guardHtml(res, API)).toBe(res);
});

it('anexo .html do Storage passa igual', () => {
  const res = html(200);
  expect(guardHtml(res, 'https://x/supabase/storage/v1/object/authenticated/a/b.html')).toBe(res);
});
