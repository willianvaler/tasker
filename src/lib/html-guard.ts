import { tr } from './i18n-ref';

/**
 * O Supabase nunca responde HTML. Quando vem HTML, quem respondeu foi outro no caminho: a página
 * de erro da Cloudflare, o proxy da rede da empresa (inspeção de SSL, bloqueio) ou o portal de um
 * Wi-Fi. A resposta vira um erro curto em JSON com status 502: a tela mostra uma frase em vez da
 * página inteira, e o login trata como falha passageira de rede (com um 4xx em HTML ele dava a
 * sessão por morta e a apagava, e a pessoa precisava entrar de novo).
 */
export function guardHtml(res: Response, url = res.url): Response {
  if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) return res;
  // Anexo .html baixado do Storage é HTML de verdade (só a resposta certa; erro dele vem em JSON)
  if (res.ok && url.includes('/storage/v1/object/')) return res;
  return new Response(
    JSON.stringify({ message: tr('sync.badResponse'), code: 'html_response', status: res.status }),
    { status: 502, statusText: 'Bad Gateway', headers: { 'content-type': 'application/json' } },
  );
}

/** `fetch` que passa toda resposta pelo `guardHtml` */
export const guardedFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return fetch(input, init).then((res) => guardHtml(res, url));
};
