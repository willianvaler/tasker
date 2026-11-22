import { describe, expect, it } from '@jest/globals';

import { emailIcs, renderEmail } from '../../../supabase/functions/_shared/email-text';

const booking = {
  guest: 'Bia',
  owner: 'Ana',
  type_name: 'Conversa',
  starts_at: '2026-11-23T12:00:00Z',
  ends_at: '2026-11-23T12:30:00Z',
  timezone: 'America/Sao_Paulo',
  uid: 'abc',
  link: 'https://questlist.wavdev.org/reserva/abc',
};
const now = new Date('2026-11-21T10:00:00Z');

describe('renderEmail', () => {
  it('confirmação: assunto, hora no fuso da dona, link e .ics', () => {
    const e = renderEmail('booking_confirmed', booking, 'pt-BR', now);
    expect(e.subject).toBe('Confirmado: Conversa com Ana, segunda-feira, 23 de novembro às 09:00');
    expect(e.text).toContain('Olá, Bia!');
    expect(e.text).toContain('(America/Sao_Paulo)');
    expect(e.text).toContain('Ver, remarcar ou cancelar: https://questlist.wavdev.org/reserva/abc');
    expect(e.ics).toContain('DTSTART:20261123T120000Z');
    expect(e.ics).toContain('UID:abc@questlist');
    expect(e.html).toContain('href="https://questlist.wavdev.org/reserva/abc"');
  });
  it('nos outros idiomas', () => {
    expect(renderEmail('booking_pending', booking, 'en', now).subject).toBe(
      'Request sent: Conversa with Ana',
    );
    expect(renderEmail('booking_declined', booking, 'es', now).subject).toBe(
      'Ana no pudo aceptar: Conversa',
    );
    // Idioma desconhecido vira português
    expect(renderEmail('booking_pending', booking, 'fr', now).subject).toBe(
      'Pedido enviado: Conversa com Ana',
    );
  });
  it('cancelamento: quem cancelou muda o texto e o .ics cancela', () => {
    const byOwner = renderEmail(
      'booking_cancelled',
      { ...booking, cancelled_by: 'owner' },
      'pt-BR',
      now,
    );
    expect(byOwner.text).toContain('Ana cancelou Conversa');
    expect(byOwner.text).not.toContain('/reserva/abc');
    expect(byOwner.ics).toContain('METHOD:CANCEL');
    expect(byOwner.ics).toContain('STATUS:CANCELLED');
    const byGuest = renderEmail(
      'booking_cancelled',
      { ...booking, cancelled_by: 'guest' },
      'pt-BR',
      now,
    );
    expect(byGuest.text).toContain('O cancelamento de Conversa com Ana');
  });
  it('enquete fechada: avisa quem não tinha marcado o horário', () => {
    const p = { ...booking, title: 'Café', link: 'https://x/horario/t', could: false };
    const e = renderEmail('poll_closed', p, 'pt-BR', now);
    expect(e.subject).toBe('Ficou para segunda-feira, 23 de novembro às 09:00: Café');
    expect(e.text).toContain('Você não tinha marcado esse horário');
    expect(e.text).toContain('Abrir a enquete: https://x/horario/t');
    expect(renderEmail('poll_closed', { ...p, could: true }, 'pt-BR', now).text).not.toContain(
      'não tinha marcado',
    );
  });
  it('escapa o HTML do que a pessoa escreveu', () => {
    const e = renderEmail('booking_pending', { ...booking, guest: '<b>Bia</b>' }, 'pt-BR', now);
    expect(e.html).toContain('&lt;b&gt;Bia&lt;/b&gt;');
    expect(e.html).not.toContain('<b>Bia</b>');
  });
  it('sem horário, sem .ics', () => {
    expect(emailIcs({}, 'x')).toBeUndefined();
  });
});
