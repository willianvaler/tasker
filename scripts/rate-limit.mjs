// Limite de pedidos por chave (IP) numa janela de tempo, em memória (D311). Serve às rotas
// anônimas que gravam: reservar, remarcar e cancelar pela página pública da agenda (AG2) e votar na enquete de horário (AG4). Reiniciar
// o serviço zera a conta, o que basta contra o abuso comum; o banco ainda limita por e-mail e por dia.

/** `hit(chave)` devolve true enquanto a chave estiver dentro do limite. */
export function createLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return {
    hit(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      // Limpa as chaves paradas de vez em quando, para o mapa não crescer sem fim
      if (hits.size > 5000)
        for (const [k, list] of hits) if (!list.some((at) => t - at < windowMs)) hits.delete(k);
      return true;
    },
  };
}

/** RPCs anônimas da agenda que gravam (as de leitura passam sem conta). */
export const BOOKING_WRITES =
  /^\/supabase\/rest\/v1\/rpc\/(book_slot|reschedule_booking|cancel_booking|time_poll_vote)(?:\?|$)/;

/** Abrir e executar o link de uma automação (QR e NFC, CT4): pedem login, mas o token é sondável. */
export const AUTOMATION_LINK =
  /^\/supabase\/rest\/v1\/rpc\/automation_link_(open|fire)(?:\?|$)/;
