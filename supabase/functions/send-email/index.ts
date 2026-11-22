// Edge Function "send-email" (AG5, D320): chamada pelo banco (gatilho em email_outbox, via pg_net,
// e o pg_cron de novo para o que falhou) com { id }. Monta o e-mail (../_shared/email-text.ts) e
// manda pelo Resend. Segredos no supabase/functions/.env, nunca no repositório:
//   RESEND_API_KEY       a chave do Resend (só envio)
//   EMAIL_WEBHOOK_SECRET o mesmo de app_config.email_secret
//   EMAIL_FROM           remetente, ex.: "Questlist <nao-responda@wavdev.org>" (domínio verificado)
// Não entra no FUNCTIONS do scripts/supabase-gate.mjs: de fora, o portão fecha; só o banco chama.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { renderEmail, type EmailKind } from '../_shared/email-text.ts';

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }
  const { id } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: row } = await supabase
    .from('email_outbox')
    .select('id, kind, to_email, locale, payload, status, attempts')
    .eq('id', id)
    .maybeSingle();
  if (!row) return new Response('not found', { status: 404 });
  if (row.status === 'sent') return new Response('already sent');

  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'Questlist <onboarding@resend.dev>';
  const fail = async (error: string) => {
    await supabase
      .from('email_outbox')
      .update({ status: 'failed', attempts: row.attempts + 1, last_error: error.slice(0, 500) })
      .eq('id', row.id);
    return new Response(error, { status: 502 });
  };
  if (!key) return fail('RESEND_API_KEY ausente');

  const email = renderEmail(row.kind as EmailKind, row.payload ?? {}, row.locale);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // A mesma linha não sai duas vezes mesmo se o banco chamar de novo
      'Idempotency-Key': `outbox-${row.id}`,
    },
    body: JSON.stringify({
      from,
      to: [row.to_email],
      subject: email.subject,
      text: email.text,
      html: email.html,
      ...(email.ics
        ? {
            attachments: [
              {
                filename: row.locale === 'es' ? 'invitacion.ics' : 'convite.ics',
                content: toBase64(email.ics),
                content_type: 'text/calendar; charset=utf-8',
              },
            ],
          }
        : {}),
    }),
  });
  if (!res.ok) return fail(`Resend ${res.status}: ${await res.text()}`);
  await supabase
    .from('email_outbox')
    .update({
      status: 'sent',
      attempts: row.attempts + 1,
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', row.id);
  return Response.json({ sent: true });
});
