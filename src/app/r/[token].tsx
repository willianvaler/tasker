import { router, useLocalSearchParams } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { InviteShell } from '@/components/invite-shell';
import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLinkFire, useLinkOpen } from '@/lib/queries/automation-rules';
import { useSession } from '@/providers/session';

// Link de uma automação (CT4, D362): /r/<token>, aberto por QR, etiqueta NFC ou atalho. Fora do
// login como os convites (entrar aqui mesmo); executa como a dona, que é a única para quem o link
// vale. Pede confirmação se a regra tem webhook ou dispositivo, ou se a dona deixou ligado.
export default function AutomationLinkScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const open = useLinkOpen(token, !!session);
  const fire = useLinkFire();
  const tried = useRef(false);
  const info = open.data;

  // Sem confirmação: executa ao abrir, uma vez
  useEffect(() => {
    if (tried.current || !token || !info?.valido || !info.ligada || info.confirmar) return;
    tried.current = true;
    fire.mutate({ token, confirmed: false });
  }, [info, token, fire]);

  let body;
  if (!session) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('autoLink.signInTitle')}</Text>
        <Text className="text-sm text-ink-muted">{t('autoLink.signInHint')}</Text>
        <SignInForm initialMode="sign-in" />
      </>
    );
  } else if (open.isPending) {
    body = <Text className="text-center text-sm text-ink-muted">{t('autoLink.opening')}</Text>;
  } else if (open.error || !info?.valido) {
    body = (
      <>
        <Text className="font-serif text-xl text-ink">{t('autoLink.invalid')}</Text>
        <Text className="text-sm text-ink-muted">{t('autoLink.invalidHint')}</Text>
        <Button variant="ghost" label={t('invite.goHome')} onPress={() => router.replace('/')} />
      </>
    );
  } else {
    const done = fire.isSuccess;
    body = (
      <>
        <View className="gap-2 border-b border-line pb-6">
          <Icon icon={Zap} size={20} tone="ink-muted" />
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {info.nome || t('autoLink.unnamed')}
          </Text>
          {!info.ligada ? (
            <Text className="text-sm text-danger">{t('autoLink.disabled')}</Text>
          ) : done ? (
            <Text className="text-sm text-ink" accessibilityLiveRegion="polite" aria-live="polite">
              {t('autoLink.done')}
            </Text>
          ) : info.confirmar ? (
            <Text className="text-sm text-ink-muted">
              {info.externo ? t('autoLink.confirmExternal') : t('autoLink.confirm')}
            </Text>
          ) : (
            <Text className="text-sm text-ink-muted">{t('autoLink.running')}</Text>
          )}
          {fire.error && <Text className="text-sm text-danger">{fire.error.message}</Text>}
        </View>
        {info.ligada && !done && info.confirmar && (
          <Button
            label={t('autoLink.run')}
            loading={fire.isPending}
            onPress={() => token && fire.mutate({ token, confirmed: true })}
          />
        )}
        <Button
          variant="ghost"
          label={t('autoLink.history')}
          onPress={() =>
            router.replace({ pathname: '/automacao/[id]', params: { id: info.regra } })
          }
        />
        <Button variant="ghost" label={t('invite.goHome')} onPress={() => router.replace('/')} />
      </>
    );
  }
  return <InviteShell>{body}</InviteShell>;
}
