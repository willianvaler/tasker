// Edge Function "read-photo" (ESCOPO_V9 §2 e §3, GA4): lê a foto de uma nota (gasto) ou de uma
// lista de papel (tarefas) e devolve o que entendeu, para a pessoa conferir antes de salvar.
// Chamada pelo app com o login da pessoa: { image (base64), mime, kind: 'receipt' | 'list',
// language }. Nada é gravado além do registro da leitura (`photo_reads`, para o limite do mês).
//
// Quem lê (V9-1): o Gemini (API do Google AI Studio, GEMINI_API_KEY; modelo em GEMINI_MODEL).
// Sem chave e com PHOTO_READER=fake, devolve uma leitura de exemplo (desenvolvimento e E2E).
// Segredos em supabase/functions/.env (fora do git), carregados no `supabase start`.
import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash';
/** Foto já reduzida no app (~1600 px); acima disso é engano */
const MAX_BASE64 = 8 * 1024 * 1024;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// O que se pede ao modelo. Valores em unidades da moeda (12.5 = R$ 12,50); o app passa a centavos.
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    readable: {
      type: 'boolean',
      description: 'false if the photo is not a receipt or is unreadable',
    },
    store: { type: ['string', 'null'], description: 'Store or business name, short' },
    date: { type: ['string', 'null'], description: 'Purchase date as YYYY-MM-DD' },
    total: {
      type: ['number', 'null'],
      description: 'Total paid, in currency units (e.g. 1234.56)',
    },
    currency: { type: ['string', 'null'], description: 'ISO 4217 code, e.g. BRL' },
    payment_method: {
      type: ['string', 'null'],
      description: 'One of: pix, card, cash, transfer, boleto; null if not printed',
    },
    tax_id: { type: ['string', 'null'], description: 'CNPJ/CPF/tax id of the store, digits only' },
    access_key: {
      type: ['string', 'null'],
      description: 'Brazilian NFC-e/NF-e access key (chave de acesso), 44 digits, digits only',
    },
    category: {
      type: ['string', 'null'],
      description: 'One of: material, labor, transport, food, lodging, services, other',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          amount: { type: 'number', description: 'Line total in currency units' },
        },
        required: ['description', 'amount'],
      },
    },
  },
  required: ['readable', 'store', 'date', 'total', 'items'],
};

const LIST_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean' },
    lines: { type: 'array', items: { type: 'string' }, description: 'One item per line, in order' },
  },
  required: ['readable', 'lines'],
};

function prompt(kind: 'receipt' | 'list', language: string) {
  if (kind === 'receipt')
    return (
      'You read a photo of a purchase receipt, invoice or bill (often a Brazilian "cupom fiscal" / NFC-e). ' +
      'Extract the store name, purchase date, the TOTAL actually paid (not subtotal), currency, payment method, ' +
      'the store tax id, the 44-digit access key if printed (it is often split in groups of 4 digits), ' +
      'a likely category and the line items. Use null for anything you cannot read with confidence; never guess numbers. ' +
      `Write the store name and item descriptions as printed. The user's language is ${language}.`
    );
  return (
    'You read a photo of a handwritten or printed list (to-do list, shopping list or workout). ' +
    'Return each item as one line, in order, without bullets or numbering, keeping quantities and notes ' +
    `such as "3x12 40kg" or dates as written. Skip titles and crossed-out items. The user's language is ${language}.`
  );
}

/** Texto da resposta: API Interactions (steps → model_output) ou generateContent (candidates). */
function answerText(body: Record<string, unknown>): string | null {
  if (typeof body.output_text === 'string') return body.output_text;
  const steps = Array.isArray(body.steps) ? body.steps : [];
  for (const step of steps as { type?: string; content?: { type?: string; text?: string }[] }[]) {
    if (step.type !== 'model_output') continue;
    const text = step.content?.find((c) => c.type === 'text')?.text;
    if (text) return text;
  }
  const outputs = Array.isArray(body.outputs) ? body.outputs : [];
  for (const out of outputs as { type?: string; text?: string }[])
    if (out.type === 'text' && out.text) return out.text;
  const candidates = body.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
  return candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? null;
}

async function readWithGemini(
  key: string,
  model: string,
  kind: 'receipt' | 'list',
  image: string,
  mime: string,
  language: string,
) {
  const schema = kind === 'receipt' ? RECEIPT_SCHEMA : LIST_SCHEMA;
  const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
  // API Interactions (a atual); `store: false`: o Google não guarda a conversa para consulta
  let res = await fetch(`${GEMINI}/interactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { type: 'text', text: prompt(kind, language) },
        { type: 'image', data: image, mime_type: mime },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema },
    }),
  });
  // Chave errada: não adianta tentar de outro jeito
  const first = res.ok ? '' : await res.clone().text();
  if (/API_KEY_INVALID|PERMISSION_DENIED/.test(first))
    throw new Error(`Gemini chave: ${first.slice(0, 200)}`);
  // Conta ou modelo sem a API Interactions: o generateContent de sempre
  if (res.status === 404 || res.status === 400) {
    res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt(kind, language) },
              { inline_data: { mime_type: mime, data: image } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
      }),
    });
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Gemini ${res.status}: ${detail}`);
  }
  const text = answerText(await res.json());
  if (!text) throw new Error('Gemini sem resposta');
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
}

/** Leitura de exemplo (sem chave, PHOTO_READER=fake): sempre a mesma nota e a mesma lista. */
function fakeRead(kind: 'receipt' | 'list') {
  if (kind === 'list')
    return {
      readable: true,
      lines: ['Supino 3x10 40kg', 'Agachamento 4x8', 'Comprar luvas amanhã'],
    };
  return {
    readable: true,
    store: 'Mercado Exemplo',
    date: new Date().toISOString().slice(0, 10),
    total: 87.9,
    currency: 'BRL',
    payment_method: 'pix',
    tax_id: '12345678000190',
    access_key: '3526 1012 3456 7800 0190 6500 1000 0123 4510 0012 3456',
    category: 'food',
    items: [
      { description: 'Café 500g', amount: 32.9 },
      { description: 'Pão de forma', amount: 12.5 },
      { description: 'Queijo', amount: 42.5 },
    ],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth } = await service.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'auth', message: 'Entre na sua conta.' }, 401);

  let body: { image?: unknown; mime?: unknown; kind?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'body' }, 400);
  }
  const kind = body.kind === 'list' ? 'list' : body.kind === 'receipt' ? 'receipt' : null;
  const mime = typeof body.mime === 'string' && MIMES.has(body.mime) ? body.mime : null;
  const image = typeof body.image === 'string' ? body.image : '';
  const language = typeof body.language === 'string' ? body.language.slice(0, 10) : 'pt-BR';
  if (!kind || !mime || !image || image.length > MAX_BASE64) return json({ error: 'body' }, 400);

  // Limite do mês (V9-3): conta só as leituras que deram certo; nulo = sem limite (fase de teste)
  const { data: limit, error: limitError } = await service.rpc('photo_read_limit');
  if (limitError) return json({ error: 'failed' }, 500);
  // Quantas sobram depois desta (nulo sem limite)
  let left: number | null = null;
  if (typeof limit === 'number') {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await service
      .from('photo_reads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('ok', true)
      .gte('created_at', since.toISOString());
    if ((count ?? 0) >= limit) return json({ error: 'limit', limit }, 429);
    left = Math.max(0, limit - (count ?? 0) - 1);
  }

  const key = Deno.env.get('GEMINI_API_KEY');
  const fake = !key && Deno.env.get('PHOTO_READER') === 'fake';
  if (!key && !fake) return json({ error: 'not_configured' }, 503);
  const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;

  const log = (ok: boolean) =>
    service.from('photo_reads').insert({
      user_id: user.id,
      kind,
      provider: fake ? 'fake' : 'gemini',
      model: fake ? null : model,
      ok,
    });
  try {
    const result = fake
      ? fakeRead(kind)
      : await readWithGemini(key!, model, kind, image, mime, language);
    await log(true);
    return json({ result, left });
  } catch (err) {
    await log(false);
    console.error('read-photo', err instanceof Error ? err.message : err);
    // Cota do plano gratuito do Gemini esgotada (minuto ou dia): diz para tentar mais tarde
    const message = err instanceof Error ? err.message : '';
    const busy = /Gemini 429/.test(message);
    if (/Gemini chave/.test(message)) return json({ error: 'not_configured' }, 503);
    return json({ error: busy ? 'busy' : 'failed' }, busy ? 503 : 502);
  }
});
