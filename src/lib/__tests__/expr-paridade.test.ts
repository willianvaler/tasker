import { describe, expect, test } from '@jest/globals';

import { avaliarExpr } from '@/lib/expr';

import { gerarCasos, QUANDO, VARS } from '../../../supabase/functions/_shared/expr-casos';

// FN0 (ESCOPO_V16 §11): os mesmos 500 casos no app (Node) e na Edge Function (Deno), com resultados
// idênticos. A parte do Deno só roda com o Supabase local no ar (o edge runtime); sem ele, fica o
// retrato dos resultados do Node, que também acusa mudança na linguagem.

// Sem @types/node no projeto: o Jest roda no Node, então o require e o process existem
declare const require: (id: string) => unknown;
declare const process: { env: Record<string, string | undefined> };

const casos = gerarCasos();
const node = casos.map((expr) => ({ expr, res: avaliarExpr(expr, VARS, QUANDO) }));

function segredo(): string | undefined {
  try {
    const fs = require('fs') as { readFileSync: (p: string, e: string) => string };
    return /^AUTOMATION_WEBHOOK_SECRET=(.+)$/m.exec(fs.readFileSync('supabase/functions/.env', 'utf8'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

describe('paridade das expressões (FN0)', () => {
  test('506 casos (500 gerados e 6 de erro), sem exceção', () => {
    expect(node).toHaveLength(506);
    const ok = node.filter((c) => c.res.ok).length;
    // Os gerados cobrem valores e erros (campo que não existe, aridade, sintaxe)
    expect(ok).toBeGreaterThan(200);
    expect(node.length - ok).toBeGreaterThan(20);
  });

  test('os resultados do Node não mudam sem querer', () => {
    expect(node).toMatchSnapshot();
  });

  test('o Deno (Edge Function) calcula igual', async () => {
    const url = process.env.EXPR_PARIDADE_URL ?? 'http://127.0.0.1:54321/functions/v1/expr-paridade';
    const s = segredo();
    let deno: unknown;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'x-webhook-secret': s ?? '' } });
      if (!res.ok) throw new Error(String(res.status));
      deno = await res.json();
    } catch {
      // Sem o Supabase local (CI): fica só o retrato do Node
      return;
    }
    expect(JSON.parse(JSON.stringify(deno))).toEqual(JSON.parse(JSON.stringify(node)));
  });
});
