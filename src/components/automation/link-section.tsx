import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { QrCode } from '@/components/qr-code';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { canPrint, printHtml } from '@/lib/print';
import { qrSvg } from '@/lib/qr';
import { QR_COLORS } from '@/lib/tokens';
import { useLink, useRuleMutations } from '@/lib/queries/automation-rules';
import { webUrl } from '@/lib/queries/projects';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

// Link por QR e NFC de uma automação manual (CT4, D362), no editor. O endereço aparece uma vez,
// com o QR e o botão de imprimir; depois a tela só mostra que existe, os usos e o pedir confirmação.
export function AutomationLinkSection({
  ruleId,
  ruleName,
  external,
  canEdit,
  onError,
}: {
  ruleId: string | undefined;
  ruleName: string;
  external: boolean;
  canEdit: boolean;
  onError: (e: Error) => void;
}) {
  const { t } = useTranslation();
  const link = useLink(ruleId, true);
  const m = useRuleMutations();
  const [url, setUrl] = useState<string | null>(null);
  const [revogar, setRevogar] = useState(false);

  if (!ruleId) return <Text className="text-sm text-ink-muted">{t('autoLink.saveFirst')}</Text>;

  function imprimir() {
    if (!url) return;
    const nome = escapeHtml(ruleName || t('autoLink.unnamed'));
    void printHtml(
      `<!doctype html><html><head><meta charset="utf-8"><title>${nome}</title></head>` +
        `<body style="font-family:sans-serif;text-align:center;padding:24px">` +
        `<h2 style="margin:0 0 16px">${nome}</h2>${qrSvg(url, QR_COLORS, 320)}` +
        `<p style="font-size:12px;color:#555;margin-top:16px">${escapeHtml(t('autoLink.printHint'))}</p>` +
        `</body></html>`,
    );
  }

  const data = link.data;
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink">{t('autoLink.section')}</Text>
      <Text className="text-sm text-ink-muted">
        {data
          ? t('autoLink.exists', {
              at: new Date(data.created_at).toLocaleString(),
              count: data.uses,
            })
          : t('autoLink.none')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          label={data ? t('autoLink.rotate') : t('autoLink.create')}
          disabled={!canEdit}
          onPress={() =>
            m.linkCreate.mutate(ruleId, {
              onError,
              onSuccess: (token) => setUrl(webUrl(`/r/${token}`)),
            })
          }
        />
        {data && (
          <Button
            variant="ghost"
            label={t('autoLink.revoke')}
            disabled={!canEdit}
            onPress={() => setRevogar(true)}
          />
        )}
      </View>
      {data && (
        <ToggleRow
          title={t('autoLink.askConfirm')}
          hint={external ? t('autoLink.askConfirmExternal') : t('autoLink.askConfirmHint')}
          value={external || data.confirm}
          disabled={!canEdit || external}
          onChange={(confirm) => m.linkConfirm.mutate({ id: ruleId, confirm }, { onError })}
        />
      )}
      {url && (
        <View
          className="items-start gap-2 rounded-lg bg-accent-soft p-3"
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          <Text className="text-sm font-semibold text-ink">{t('autoLink.url')}</Text>
          <QrCode value={url} size={200} label={t('autoLink.qrLabel')} />
          <Text selectable className="font-mono text-xs text-ink">
            {url}
          </Text>
          <Text className="text-xs text-ink-muted">{t('autoLink.nfcHint')}</Text>
          <Text className="text-xs text-ink-muted">{t('auto.ed.shownOnce')}</Text>
          {canPrint() && <Button variant="ghost" label={t('autoLink.print')} onPress={imprimir} />}
        </View>
      )}
      {revogar && (
        <ConfirmDialog
          title={t('autoLink.revokeTitle')}
          message={t('autoLink.revokeMessage')}
          confirmLabel={t('autoLink.revoke')}
          destructive
          onClose={() => setRevogar(false)}
          onConfirm={() => {
            setRevogar(false);
            setUrl(null);
            m.linkRevoke.mutate(ruleId, { onError });
          }}
        />
      )}
    </View>
  );
}
