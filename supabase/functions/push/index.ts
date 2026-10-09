// Edge Function "push": chamada pelo banco (trigger em notifications, via pg_net) com
// { notification_id }. Manda a notificação para os aparelhos do usuário pela API da Expo e tira os
// tokens de aparelhos que não existem mais. Segredo: PUSH_WEBHOOK_SECRET (o mesmo de app_config).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { pushMessages } from '../_shared/notification-text.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  const { notification_id } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: notification } = await supabase
    .from('notifications')
    .select('user_id, kind, payload')
    .eq('id', notification_id)
    .single();
  if (!notification) return new Response('not found', { status: 404 });

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', notification.user_id);
  if (!tokens?.length) return new Response('no devices');

  const messages = pushMessages(notification, tokens.map((t) => t.token));
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const { data: tickets = [] } = await res.json();

  // Aparelho desinstalou o app ou trocou de token: some da lista
  const gone = messages
    .filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered')
    .map((m) => m.to);
  if (gone.length) await supabase.from('push_tokens').delete().in('token', gone);

  return Response.json({ sent: messages.length, removed: gone.length });
});
