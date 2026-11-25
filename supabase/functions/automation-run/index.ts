// Edge Function "automation-run" (ESCOPO_V14 §6.1, AU2, D334): o executor das automações. Chamada
// pelo banco (inserção em automation_events, via pg_net, e o varredor do pg_cron a cada minuto) com
// { }. Reivindica execuções (automation_claim), roda os passos pelo registro de tipos
// (../_shared/automation-engine.ts) e grava cada passo (automation_step), que aplica o efeito uma vez só.
// Efeito para fora (webhook, AU8, D339) é feito aqui, com o anti-SSRF de ../_shared/webhook-out.ts:
// conecta no IP já validado e o nome vai só para o TLS.
// Segredo no supabase/functions/.env, nunca no repositório:
//   AUTOMATION_WEBHOOK_SECRET  o mesmo de app_config.automation_secret
// Não entra no FUNCTIONS do scripts/supabase-gate.mjs: de fora, o portão fecha; só o banco chama.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  executeRun,
  expandir,
  registroBase,
  type Execucao,
  type ExternoFn,
} from '../_shared/automation-engine.ts';
import { avaliarExpr, formulaFields, parseFormula } from '../_shared/expr.ts';
import { executarToken, type ExprApi, type TokenReivindicado } from '../_shared/processo.ts';
import {
  enviarWebhook,
  MAX_RESPOSTA,
  TEMPO_MS,
  type EfeitoWebhook,
} from '../_shared/webhook-out.ts';

// Expressões dos processos (FN0): as mesmas do app
const exprApi: ExprApi = {
  erro: (texto) => {
    const p = parseFormula(texto);
    return p.ok ? null : p.error.code;
  },
  campos: (texto) => {
    const p = parseFormula(texto);
    return p.ok ? formulaFields(p.node) : [];
  },
  avaliar: (texto, vars, quando) => avaliarExpr(texto, vars, quando),
};

// Tempo ativo por chamada (o varredor chama de novo no minuto seguinte se sobrar trabalho)
const BUDGET_MS = 25_000;

async function resolver(host: string): Promise<string[]> {
  const [a, aaaa] = await Promise.allSettled([
    Deno.resolveDns(host, 'A'),
    Deno.resolveDns(host, 'AAAA'),
  ]);
  return [
    ...(a.status === 'fulfilled' ? a.value : []),
    ...(aaaa.status === 'fulfilled' ? aaaa.value : []),
  ];
}

/** TCP no IP validado, TLS com o nome (certificado e SNI), pedido cru e até 64 KB de resposta. */
async function conectar(
  ip: string,
  porta: number,
  host: string,
  dados: string,
): Promise<Uint8Array> {
  const tcp = await Deno.connect({ hostname: ip, port: porta });
  let tls: Deno.TlsConn | null = null;
  const timer = setTimeout(() => (tls ?? tcp).close(), TEMPO_MS);
  try {
    tls = await Deno.startTls(tcp, { hostname: host });
    await tls.write(new TextEncoder().encode(dados));
    const partes: Uint8Array[] = [];
    let total = 0;
    const buf = new Uint8Array(16 * 1024);
    while (total < MAX_RESPOSTA) {
      const n = await tls.read(buf);
      if (n === null) break;
      partes.push(buf.slice(0, n));
      total += n;
    }
    const out = new Uint8Array(total);
    let i = 0;
    for (const p of partes) {
      out.set(p, i);
      i += p.length;
    }
    return out;
  } finally {
    clearTimeout(timer);
    try {
      (tls ?? tcp).close();
    } catch {
      // já fechada pelo tempo
    }
  }
}

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

  const externo: ExternoFn = async (efeito, chave, run) => {
    if (efeito.tipo !== 'webhook') return { erro: `Efeito externo desconhecido: ${efeito.tipo}` };
    const { data: segredos, error } = await supabase.rpc('automation_run_secrets', {
      p_run: run.id,
    });
    if (error) return { tentar: 'Não deu para ler os segredos da automação' };
    return enviarWebhook(
      efeito as unknown as EfeitoWebhook,
      chave,
      (segredos ?? {}) as Record<string, string>,
      {
        resolver,
        conectar,
      },
    );
  };

  while (Date.now() - start < BUDGET_MS) {
    const { data, error } = await supabase.rpc('automation_claim', { p_limit: 20 });
    if (error) return new Response(`claim: ${error.message}`, { status: 500 });
    const runs = (data ?? []) as Execucao[];
    if (runs.length === 0) break;
    for (const run of runs) {
      const res = await executeRun(
        run,
        registro,
        async (c) => {
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
        },
        { externo },
      );
      total[res]++;
    }
  }
  // Processos (PR4, D352): os tokens prontos, pelo mesmo registro de passos e o mesmo webhook
  const processos = { ok: 0, ignorado: 0 };
  while (Date.now() - start < BUDGET_MS) {
    const { data, error } = await supabase.rpc('process_claim', { p_limit: 20 });
    if (error) return new Response(`process_claim: ${error.message}`, { status: 500 });
    const tokens = (data ?? []) as TokenReivindicado[];
    if (tokens.length === 0) break;
    for (const t of tokens) {
      const res = await executarToken(t, {
        expr: exprApi,
        passo: (tipo) => registro.get(tipo) as never,
        expandir: (texto, estado) =>
          expandir(
            texto,
            {
              estado,
              escopo: 'pessoal',
              regra: { id: t.definition, nome: t.name },
              agora: new Date().toISOString(),
              fuso: t.fuso,
              idioma: t.idioma,
              usuario: t.usuario,
            },
            [],
          ),
        externo: async (efeito, chave) => {
          if (efeito.tipo !== 'webhook')
            return { erro: `Efeito externo desconhecido: ${String(efeito.tipo)}` };
          return enviarWebhook(
            efeito as unknown as EfeitoWebhook,
            chave,
            {},
            { resolver, conectar },
          );
        },
        commit: async (token, claim, decisao) => {
          const { data: out, error: e } = await supabase.rpc('process_advance', {
            p_token: token,
            p_claim: claim,
            p_decision: decisao,
          });
          if (e) return 'ignorado';
          return out as 'ok' | 'ignorado';
        },
      });
      processos[res]++;
    }
  }
  return Response.json({ ...total, processos });
});
