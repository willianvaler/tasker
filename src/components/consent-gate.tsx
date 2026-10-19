import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { LEGAL_VERSION } from '@/content/legal';
import { signOut } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';

const statusSchema = z.object({
  current: z.string(),
  accepted: z.string().nullable(),
  accepted_at: z.string().nullable(),
});

/** Versão dos termos aceita por último (V5 §4, D213). Só online: o aceite é do servidor. */
export function useConsentStatus() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['consent'],
    enabled: !!session,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('consent_status');
      if (error) throw error;
      return statusSchema.parse(data);
    },
  });
}

/**
 * Conta que ainda não aceitou a versão vigente dos termos e da política (de antes deles, ou depois
 * de uma mudança): pede o aceite antes de continuar. Sem conexão, não bloqueia.
 */
export function ConsentGate() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const status = useConsentStatus();
  const queryClient = useQueryClient();
  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('accept_terms', { p_version: LEGAL_VERSION });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['consent'] }),
  });
  const data = status.data;
  // O app ainda é de uma versão anterior à do servidor: só pede depois de atualizar
  if (!online || !data || data.accepted === data.current || data.current !== LEGAL_VERSION)
    return null;
  return (
    // Camada da área logada (não um Modal): os links abrem os termos por cima dela
    <View className="absolute inset-0 items-center justify-center bg-scrim/40 px-4">
      <View className="w-full items-center">
        <View
          accessibilityRole="alert"
          className="w-full max-w-md gap-4 rounded-lg border border-line bg-paper p-6"
        >
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {t(data.accepted ? 'legal.updatedTitle' : 'legal.firstTitle')}
          </Text>
          <Text className="text-sm text-ink-muted">{t('legal.gateText')}</Text>
          <View className="flex-row flex-wrap gap-4">
            <Link href="/termos" asChild>
              <Text accessibilityRole="link" className="text-sm text-ink underline">
                {t('legal.terms')}
              </Text>
            </Link>
            <Link href="/privacidade" asChild>
              <Text accessibilityRole="link" className="text-sm text-ink underline">
                {t('legal.privacy')}
              </Text>
            </Link>
          </View>
          {accept.error && <Text className="text-sm text-danger">{accept.error.message}</Text>}
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button variant="ghost" label={t('legal.signOut')} onPress={() => signOut()} />
            <Button
              label={t('legal.accept')}
              loading={accept.isPending}
              onPress={() => accept.mutate()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
