// Edge Function "automation-run" (ESCOPO_V14 §6.1, AU2, D334): o executor das automações. Chamada
// pelo banco (inserção em automation_events, via pg_net, e o varredor do pg_cron a cada minuto) com
// { }. Reivindica execuções (automation_claim), roda os passos pelo registro de tipos
// (../_shared/automation-engine.ts) e grava cada passo (automation_step), que aplica o efeito uma vez só.
// Segredo no supabase/functions/.env, nunca no repositório:
//   AUTOMATION_WEBHOOK_SECRET  o mesmo de app_config.automation_secret
// Não entra no FUNCTIONS do scripts/supabase-gate.mjs: de fora, o portão fecha; só o banco chama.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { executeRun, registroBase, type Execucao } from '../_shared/automation-engine.ts';

// Tempo ativo por chamada (o varredor chama de novo no minuto seguinte se sobrar trabalho)
const BUDGET_MS = 25_000;

Deno.serve(async (req) => {
  const secret = Deno.env.get('AUTOMATION_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const registro = registroBase();
  const start = Date.now();
  const total = { ok: 0, falhou: 0, ignorado: 0, esperando: 0, tentar: 0 };

  while (Date.now() - start < BUDGET_MS) {
    const { data, error } = await supabase.rpc('automation_claim', { p_limit: 20 });
    if (error) return new Response(`claim: ${error.message}`, { status: 500 });
    const runs = (data ?? []) as Execucao[];
    if (runs.length === 0) break;
    for (const run of runs) {
      const res = await executeRun(run, registro, async (c) => {
        const { data: out, error: e } = await supabase.rpc('automation_step', {
          p_run: c.run,
          p_claim: c.claim,
          p_step: c.step,
          p_next: c.next,
          p_state: c.state,
          p_effect: c.effect,
          p_log: c.log,
          p_warnings: c.warnings,
          p_status: c.status,
          p_error: c.error,
          p_resume: c.resume,
        });
        // Erro de rede: a execução fica "rodando" e volta pela reivindicação vencida (2 min)
        if (e) return 'ignorado';
        return out as 'ok' | 'ignorado' | 'falhou';
      });
      total[res]++;
    }
  }
  return Response.json(total);
});
