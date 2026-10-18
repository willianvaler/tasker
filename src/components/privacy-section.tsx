import { Link } from 'expo-router';
import { Download, Sheet, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PromptDialog, useDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { saveTextFile } from '@/lib/download';
import { tasksToCsv } from '@/lib/export';
import { clearPrefs } from '@/lib/prefs';
import { formatBytes, MAX_ACCOUNT_BYTES } from '@/lib/attachments';
import { useAttachmentUsage } from '@/lib/queries/attachments';
import { deleteMyAccount, exportMyData } from '@/lib/queries/clan';
import { signOut as endSession } from '@/lib/session';
import { useIsOnline } from '@/providers/online';
import { clearQueryCache } from '@/providers/query';
import { useToast } from '@/providers/toast';

/** Seus dados: exportar (JSON completo ou CSV das tarefas) e excluir a conta. */
export function PrivacySection() {
  const { t, i18n } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const usage = useAttachmentUsage();
  const [busy, setBusy] = useState<'json' | 'csv' | 'delete' | null>(null);
  const [confirm, setConfirm, close] = useDialog<true>();

  async function download(format: 'json' | 'csv') {
    setBusy(format);
    try {
      const data = await exportMyData();
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'json')
        await saveTextFile(
          `questlist-${date}.json`,
          JSON.stringify(data, null, 2),
          'application/json',
        );
      else
        await saveTextFile(
          `questlist-${t('privacy.csvName')}-${date}.csv`,
          tasksToCsv((data.tasks as Parameters<typeof tasksToCsv>[0]) ?? []),
          'text/csv',
        );
    } catch (err) {
      toast({ message: t('privacy.exportError', { message: (err as Error).message }) });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    close();
    setBusy('delete');
    try {
      await deleteMyAccount();
      await endSession();
      clearQueryCache();
      clearPrefs();
    } catch (err) {
      toast({ message: t('privacy.deleteError', { message: (err as Error).message }) });
      setBusy(null);
    }
  }

  return (
    <View className="gap-3">
      {usage.data !== undefined && (
        <Text className="text-sm text-ink-muted">
          {t('attach.usage', {
            used: formatBytes(usage.data, i18n.language),
            total: formatBytes(MAX_ACCOUNT_BYTES, i18n.language),
          })}
        </Text>
      )}
      <Text className="text-sm text-ink-muted">{t('privacy.exportHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          icon={Download}
          label={t('privacy.exportJson')}
          disabled={!online || !!busy}
          loading={busy === 'json'}
          onPress={() => download('json')}
        />
        <Button
          variant="ghost"
          icon={Sheet}
          label={t('privacy.exportCsv')}
          disabled={!online || !!busy}
          loading={busy === 'csv'}
          onPress={() => download('csv')}
        />
      </View>
      <Button
        variant="ghost"
        className="self-start"
        icon={Trash2}
        label={t('privacy.delete')}
        disabled={!online || !!busy}
        loading={busy === 'delete'}
        onPress={() => setConfirm(true)}
      />
      {confirm && (
        <PromptDialog
          title={t('privacy.deleteTitle')}
          confirmLabel={t('privacy.deleteConfirm')}
          fields={[{ key: 'confirm', placeholder: t('privacy.deletePlaceholder') }]}
          onClose={close}
          onConfirm={({ confirm: typed }) => {
            if (typed.toUpperCase() === t('privacy.deleteWord')) remove();
            else toast({ message: t('privacy.deleteType') });
          }}
        />
      )}
      <Text className="text-xs text-ink-muted">{t('privacy.deleteHint')}</Text>
      <Link href="/privacidade" asChild>
        <Pressable accessibilityRole="link" className="min-h-8 justify-center self-start">
          <Text className="text-sm text-ink underline">{t('privacy.policy')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}
