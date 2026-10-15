import * as Clipboard from 'expo-clipboard';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, Share, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { shareUrl, usePageShares, useShareMutations } from '@/lib/queries/shares';
import { useToast } from '@/providers/toast';

// "Enviar para…" (L3, D135): modo (ao vivo ou cópia), link para mandar por qualquer app, e-mails,
// e quem já recebeu (com revogar). Precisa de conexão.

type Mode = 'live' | 'copy';

export function SendPageDialog({
  page,
  onClose,
}: {
  page: { id: string; name: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const shares = usePageShares(page.id);
  const m = useShareMutations(page.id);
  const [mode, setMode] = useState<Mode>('live');
  const [emails, setEmails] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const onError = (err: Error) => toast({ message: err.message });

  async function makeLink() {
    const created = await m.createLink.mutateAsync(mode).catch(onError);
    if (!created) return;
    const url = shareUrl(created.token);
    setLink(url);
    await Clipboard.setStringAsync(url).catch(() => {});
    toast({ message: t('send.linkCopied') });
    if (Platform.OS !== 'web') Share.share({ message: url }).catch(() => {});
  }

  function sendEmails() {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    m.byEmail.mutate(
      { emails: list, mode },
      {
        onError,
        onSuccess: (count) => {
          setEmails('');
          toast({ message: t('send.emailsSent', { count: count ?? 0 }) });
        },
      },
    );
  }

  const list = shares.data?.shares ?? [];
  return (
    <DialogFrame wide onClose={onClose}>
      <ScrollView contentContainerClassName="gap-4">
        <Text className="text-lg font-semibold text-ink">
          {t('send.title', { page: page.name })}
        </Text>
        <View className="gap-2" accessibilityRole="radiogroup">
          {(['live', 'copy'] as const).map((value) => (
            <Chip
              key={value}
              role="radio"
              label={t(value === 'live' ? 'send.modeLive' : 'send.modeCopy')}
              selected={mode === value}
              onPress={() => setMode(value)}
            />
          ))}
          <Text className="text-sm text-ink-muted">
            {t(mode === 'live' ? 'send.modeLiveHint' : 'send.modeCopyHint')}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('send.byLink')}
          </Text>
          <Button label={t('send.makeLink')} disabled={m.createLink.isPending} onPress={makeLink} />
          {link && (
            <Text
              selectable
              className="font-mono text-xs text-ink"
              accessibilityLabel={t('send.link')}
            >
              {link}
            </Text>
          )}
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('send.byEmail')}
          </Text>
          <Input
            value={emails}
            onChangeText={setEmails}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('send.emailsPlaceholder')}
            accessibilityLabel={t('send.emails')}
            onSubmitEditing={sendEmails}
          />
          <Button
            variant="ghost"
            className="self-start"
            label={t('send.sendEmails')}
            disabled={!emails.trim() || m.byEmail.isPending}
            onPress={sendEmails}
          />
        </View>

        {list.length > 0 && (
          <View className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('send.recipients')}
            </Text>
            {list.map((share) => {
              const who = share.recipient_name ?? share.recipient_email ?? '—';
              const state = t(share.status === 'pending' ? 'send.pending' : 'send.active');
              const kind = t(share.mode === 'live' ? 'send.live' : 'send.copy');
              return (
                <View
                  key={share.id}
                  className="min-h-11 flex-row items-center gap-2 border-b border-line"
                >
                  <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
                    {who}
                  </Text>
                  <Text className="font-mono text-xs text-ink-muted">
                    {kind} · {state}
                  </Text>
                  <IconButton
                    icon={X}
                    label={t('send.revoke', { name: who })}
                    onPress={() => m.revoke.mutate(share.id, { onError })}
                  />
                </View>
              );
            })}
          </View>
        )}
        <Button variant="ghost" className="self-end" label={t('common.close')} onPress={onClose} />
      </ScrollView>
    </DialogFrame>
  );
}
