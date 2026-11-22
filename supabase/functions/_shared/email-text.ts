// Texto dos e-mails da agenda (AG5, D320): assunto, corpo em texto e em HTML e o .ics, em três
// idiomas. Usado pela Edge Function `send-email` e testado no Jest. Sem imports: roda no Node e no
// Deno, como o notification-text.

export type EmailKind =
  | 'booking_confirmed'
  | 'booking_pending'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'poll_closed';

export type EmailLocale = 'pt-BR' | 'en' | 'es';

export type EmailPayload = {
  guest?: string;
  owner?: string;
  type_name?: string;
  title?: string;
  starts_at?: string;
  ends_at?: string;
  timezone?: string;
  cancelled_by?: 'guest' | 'owner' | null;
  could?: boolean;
  uid?: string;
  link?: string;
};

export type Email = { subject: string; text: string; html: string; ics?: string };

type T = { what: string; who: string; when: string; zone: string; link: string };

const TEXT: Record<
  EmailLocale,
  {
    hello: (guest: string) => string;
    subject: Record<EmailKind, (t: T) => string>;
    body: Record<EmailKind, (t: T, p: EmailPayload) => string>;
    manage: string;
    open: string;
    ics: string;
    footer: string;
  }
> = {
  'pt-BR': {
    hello: (g) => (g ? `Olá, ${g}!` : 'Olá!'),
    subject: {
      booking_confirmed: (t) => `Confirmado: ${t.what} com ${t.who}, ${t.when}`,
      booking_pending: (t) => `Pedido enviado: ${t.what} com ${t.who}`,
      booking_declined: (t) => `${t.who} não pôde aceitar: ${t.what}`,
      booking_cancelled: (t) => `Cancelado: ${t.what} com ${t.who}`,
      booking_rescheduled: (t) => `Novo horário: ${t.what} com ${t.who}, ${t.when}`,
      poll_closed: (t) => `Ficou para ${t.when}: ${t.what}`,
    },
    body: {
      booking_confirmed: (t) =>
        `Seu horário com ${t.who} está confirmado: ${t.what}, ${t.when} (${t.zone}). O convite vai anexo para a sua agenda.`,
      booking_pending: (t) =>
        `Seu pedido de ${t.what} com ${t.who} para ${t.when} (${t.zone}) foi enviado. Você recebe outro e-mail quando ${t.who} responder.`,
      booking_declined: (t) =>
        `${t.who} não pôde aceitar o pedido de ${t.what} para ${t.when} (${t.zone}). Você pode escolher outro horário na agenda.`,
      booking_cancelled: (t, p) =>
        p.cancelled_by === 'owner'
          ? `${t.who} cancelou ${t.what} de ${t.when} (${t.zone}).`
          : `O cancelamento de ${t.what} com ${t.who} de ${t.when} (${t.zone}) está feito.`,
      booking_rescheduled: (t) =>
        `${t.what} com ${t.who} passou para ${t.when} (${t.zone}). O convite novo vai anexo.`,
      poll_closed: (t, p) =>
        `${t.who} fechou a enquete "${t.what}": ficou para ${t.when} (${t.zone}).${p.could === false ? ' Você não tinha marcado esse horário; se não puder, avise.' : ''} O convite vai anexo.`,
    },
    manage: 'Ver, remarcar ou cancelar',
    open: 'Abrir a enquete',
    ics: 'Adicionar à agenda: abra o arquivo convite.ics anexo.',
    footer:
      'Enviado pelo Questlist. Você recebe este e-mail porque deixou o endereço nesta página.',
  },
  en: {
    hello: (g) => (g ? `Hi, ${g}!` : 'Hi!'),
    subject: {
      booking_confirmed: (t) => `Confirmed: ${t.what} with ${t.who}, ${t.when}`,
      booking_pending: (t) => `Request sent: ${t.what} with ${t.who}`,
      booking_declined: (t) => `${t.who} couldn't accept: ${t.what}`,
      booking_cancelled: (t) => `Canceled: ${t.what} with ${t.who}`,
      booking_rescheduled: (t) => `New time: ${t.what} with ${t.who}, ${t.when}`,
      poll_closed: (t) => `It's set for ${t.when}: ${t.what}`,
    },
    body: {
      booking_confirmed: (t) =>
        `Your time with ${t.who} is confirmed: ${t.what}, ${t.when} (${t.zone}). The invite is attached for your calendar.`,
      booking_pending: (t) =>
        `Your request for ${t.what} with ${t.who} on ${t.when} (${t.zone}) was sent. You'll get another email when ${t.who} answers.`,
      booking_declined: (t) =>
        `${t.who} couldn't accept the request for ${t.what} on ${t.when} (${t.zone}). You can pick another time on the schedule.`,
      booking_cancelled: (t, p) =>
        p.cancelled_by === 'owner'
          ? `${t.who} canceled ${t.what} on ${t.when} (${t.zone}).`
          : `Your cancellation of ${t.what} with ${t.who} on ${t.when} (${t.zone}) is done.`,
      booking_rescheduled: (t) =>
        `${t.what} with ${t.who} moved to ${t.when} (${t.zone}). The new invite is attached.`,
      poll_closed: (t, p) =>
        `${t.who} closed the poll "${t.what}": it's set for ${t.when} (${t.zone}).${p.could === false ? " You hadn't checked this time; if you can't make it, let them know." : ''} The invite is attached.`,
    },
    manage: 'See, reschedule or cancel',
    open: 'Open the poll',
    ics: 'Add to calendar: open the attached invite.ics file.',
    footer: 'Sent by Questlist. You get this email because you left your address on this page.',
  },
  es: {
    hello: (g) => (g ? `¡Hola, ${g}!` : '¡Hola!'),
    subject: {
      booking_confirmed: (t) => `Confirmado: ${t.what} con ${t.who}, ${t.when}`,
      booking_pending: (t) => `Solicitud enviada: ${t.what} con ${t.who}`,
      booking_declined: (t) => `${t.who} no pudo aceptar: ${t.what}`,
      booking_cancelled: (t) => `Cancelado: ${t.what} con ${t.who}`,
      booking_rescheduled: (t) => `Nuevo horario: ${t.what} con ${t.who}, ${t.when}`,
      poll_closed: (t) => `Quedó para el ${t.when}: ${t.what}`,
    },
    body: {
      booking_confirmed: (t) =>
        `Tu horario con ${t.who} está confirmado: ${t.what}, ${t.when} (${t.zone}). La invitación va adjunta para tu calendario.`,
      booking_pending: (t) =>
        `Tu solicitud de ${t.what} con ${t.who} para el ${t.when} (${t.zone}) fue enviada. Recibirás otro correo cuando ${t.who} responda.`,
      booking_declined: (t) =>
        `${t.who} no pudo aceptar la solicitud de ${t.what} para el ${t.when} (${t.zone}). Puedes elegir otro horario en la agenda.`,
      booking_cancelled: (t, p) =>
        p.cancelled_by === 'owner'
          ? `${t.who} canceló ${t.what} del ${t.when} (${t.zone}).`
          : `La cancelación de ${t.what} con ${t.who} del ${t.when} (${t.zone}) está hecha.`,
      booking_rescheduled: (t) =>
        `${t.what} con ${t.who} pasó al ${t.when} (${t.zone}). La nueva invitación va adjunta.`,
      poll_closed: (t, p) =>
        `${t.who} cerró la encuesta "${t.what}": quedó para el ${t.when} (${t.zone}).${p.could === false ? ' No habías marcado este horario; si no puedes, avisa.' : ''} La invitación va adjunta.`,
    },
    manage: 'Ver, cambiar o cancelar',
    open: 'Abrir la encuesta',
    ics: 'Añadir al calendario: abre el archivo invitacion.ics adjunto.',
    footer:
      'Enviado por Questlist. Recibes este correo porque dejaste tu dirección en esta página.',
  },
};

export function emailLocale(value: unknown): EmailLocale {
  return value === 'en' || value === 'es' ? value : 'pt-BR';
}

/** "segunda-feira, 23 de novembro, 09:00" no idioma e no fuso pedidos */
export function formatWhen(iso: string, locale: EmailLocale, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const icsDate = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const icsText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** O convite (.ics) do compromisso: o mesmo UID a cada e-mail, para a agenda trocar em vez de duplicar */
export function emailIcs(p: EmailPayload, summary: string, cancel = false, now = new Date()) {
  if (!p.starts_at || !p.ends_at) return undefined;
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Questlist//Agenda//PT',
      'CALSCALE:GREGORIAN',
      `METHOD:${cancel ? 'CANCEL' : 'PUBLISH'}`,
      'BEGIN:VEVENT',
      `UID:${p.uid ?? 'questlist'}@questlist`,
      `DTSTAMP:${icsDate(now.toISOString())}`,
      `DTSTART:${icsDate(p.starts_at)}`,
      `DTEND:${icsDate(p.ends_at)}`,
      `SUMMARY:${icsText(summary)}`,
      ...(cancel ? ['STATUS:CANCELLED'] : []),
      ...(p.link ? [`URL:${p.link}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  );
}

/** O e-mail pronto. O .ics vai na confirmação, na remarcação, no cancelamento e na enquete fechada. */
export function renderEmail(
  kind: EmailKind,
  p: EmailPayload,
  locale: unknown,
  now = new Date(),
): Email {
  const l = emailLocale(locale);
  const tx = TEXT[l];
  const what = (kind === 'poll_closed' ? p.title : p.type_name) ?? '';
  const t: T = {
    what,
    who: p.owner ?? '',
    when: p.starts_at ? formatWhen(p.starts_at, l, p.timezone ?? 'America/Sao_Paulo') : '',
    zone: p.timezone ?? 'America/Sao_Paulo',
    link: p.link ?? '',
  };
  const subject = tx.subject[kind](t);
  const body = tx.body[kind](t, p);
  const button = kind === 'poll_closed' ? tx.open : tx.manage;
  const withIcs =
    kind === 'booking_confirmed' ||
    kind === 'booking_rescheduled' ||
    kind === 'booking_cancelled' ||
    kind === 'poll_closed';
  const ics = withIcs
    ? emailIcs(p, `${what} · ${t.who}`, kind === 'booking_cancelled', now)
    : undefined;
  const showLink = !!p.link && kind !== 'booking_cancelled' && kind !== 'booking_declined';
  const text = [
    tx.hello(p.guest ?? ''),
    '',
    body,
    ...(showLink ? ['', `${button}: ${p.link}`] : []),
    ...(ics && kind !== 'booking_cancelled' ? ['', tx.ics] : []),
    '',
    '—',
    tx.footer,
  ].join('\n');
  const html = `<!doctype html><html lang="${l}"><body style="margin:0;padding:24px;background:#f6f3ee;font-family:Georgia,serif;color:#1f1d1a">
<div style="max-width:520px;margin:0 auto;background:#fffdf9;border:1px solid #e4ddd2;border-radius:8px;padding:24px">
<p style="margin:0 0 16px;font-size:18px">${escapeHtml(tx.hello(p.guest ?? ''))}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(body)}</p>
${showLink ? `<p style="margin:0 0 16px"><a href="${escapeHtml(p.link ?? '')}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-family:sans-serif;font-size:14px">${escapeHtml(button)}</a></p>` : ''}
<p style="margin:16px 0 0;font-family:sans-serif;font-size:12px;color:#6b655c">${escapeHtml(tx.footer)}</p>
</div></body></html>`;
  return { subject, text, html, ics };
}
