// Edge Function "expr-paridade" (FN0, D344): diagnóstico da paridade das expressões entre o app e a
// Edge Function. Calcula os 500 casos de ../_shared/expr-casos.ts no Deno e devolve os resultados,
// que o Jest compara com os do Node (src/lib/__tests__/expr-paridade.test.ts). Não lê nem grava
// nada; só com o segredo do executor (AUTOMATION_WEBHOOK_SECRET) e fora do FUNCTIONS do portão.
import { gerarCasos, QUANDO, VARS } from '../_shared/expr-casos.ts';
import { avaliarExpr } from '../_shared/expr.ts';

Deno.serve((req) => {
  const secret = Deno.env.get('AUTOMATION_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  return Response.json(gerarCasos().map((expr) => ({ expr, res: avaliarExpr(expr, VARS, QUANDO) })));
});
