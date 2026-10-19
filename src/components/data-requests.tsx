import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { useConsentStatus } from '@/components/consent-gate';
import { Button } from '@/components/ui/button';
import { ActionMenu, PromptDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { formatShortDate } from '@/lib/parser/dates';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const KINDS = ['access', 'correction', 'portability', 'deletion', 'other'] as const;
type Kind = (typeof KINDS)[number];

const requestSchema = z.object({
  id: z.string(),
  kind: z.enum(KINDS),
  status: z.enum(['open', 'answered']),
  answer: z.string().nullable(),
  created_at: z.string(),
  due_at: z.string(),
});

/**
 * Pedidos do titular (V5 §4, LGPD art. 18; D213): acesso, correção, portabilidade, eliminação ou
 * outro, com prazo de 15 dias. Mostra também a versão dos termos aceita e quando.
 */
export function DataRequests() {
  const { t } = useTranslation();
  const { session } = useSession();
  const online = useIsOnline();
  const toast = useToast();
  const queryClient = useQueryClient();
  const consent = useConsentStatus();
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const list = useQuery({
    queryKey: ['data-requests'],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_requests')
        .select('id, kind, status, answer, created_at, due_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return z.array(requestSchema).parse(data);
    },
  });
  const send = useMutation({
    mutationFn: async (v: { kind: Kind; message: string }) => {
      const { error } = await supabase.rpc('request_data_action', {
        p_kind: v.kind,
        p_message: v.message,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['data-requests'] }),
  });
  const day = (iso: string) => formatShortDate(iso.slice(0, 10));

  return (
    <View className="gap-2">
      {consent.data?.accepted && consent.data.accepted_at && (
        <Text className="text-xs text-ink-muted">
          {t('legal.acceptedOn', {
            version: consent.data.accepted,
            date: day(consent.data.accepted_at),
          })}
        </Text>
      )}
      <Text className="text-sm text-ink-muted">{t('dataRequest.hint')}</Text>
      {(list.data ?? []).map((r) => (
        <View key={r.id} className="gap-1 border-b border-line py-2">
          <Text className="text-sm text-ink">
            {t(`dataRequest.kinds.${r.kind}`)} · {day(r.created_at)}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            {r.status === 'open'
              ? t('dataRequest.open', { date: day(r.due_at) })
              : t('dataRequest.answered')}
          </Text>
          {r.answer && <Text className="text-sm text-ink">{r.answer}</Text>}
        </View>
      ))}
      <Button
        variant="ghost"
        className="self-start"
        label={t('dataRequest.new')}
        disabled={!online}
        onPress={() => setPicking(true)}
      />
      {picking && (
        <ActionMenu
          title={t('dataRequest.new')}
          onClose={() => setPicking(false)}
          actions={KINDS.map((k) => ({
            label: t(`dataRequest.kinds.${k}`),
            onPress: () => setKind(k),
          }))}
        />
      )}
      {kind && (
        <PromptDialog
          title={t(`dataRequest.kinds.${kind}`)}
          message={t('dataRequest.messageHint')}
          fields={[{ key: 'message', placeholder: t('dataRequest.message'), maxLength: 2000 }]}
          validate={() => true}
          confirmLabel={t('dataRequest.send')}
          onConfirm={({ message }) => {
            const chosen = kind;
            setKind(null);
            send.mutate(
              { kind: chosen, message },
              {
                onSuccess: () => toast({ message: t('dataRequest.sent') }),
                onError: (e) => toast({ message: e.message }),
              },
            );
          }}
          onClose={() => setKind(null)}
        />
      )}
    </View>
  );
}
