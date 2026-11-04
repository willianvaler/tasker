import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { strFromU8, unzipSync } from 'fflate';
import { Upload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import {
  importHabitica,
  importTodoist,
  isHabiticaExport,
  isTodoistCsv,
  projectData,
  type ImportPlan,
} from '@/lib/import-apps';
import { useToday } from '@/lib/queries/profile';
import { useTemplateMutations } from '@/lib/queries/projects';
import { readPickedBytes } from '@/lib/read-bytes';
import { uuidv7 } from '@/lib/uuid';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Importar do Habitica e do Todoist (PC1, D306): lê o arquivo no aparelho, mostra o que vai entrar
// e cria um projeto pessoal por origem (pelo create_from_template, como os kits).

/** Arquivo grande demais para abrir no celular */
const FILE_MAX = 30 * 1024 * 1024;

export function ImportApps() {
  const { t } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const online = useIsOnline();
  const m = useTemplateMutations();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview, closePreview] = useDialog<ImportPlan>();

  async function pick() {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/json',
          'text/csv',
          'text/comma-separated-values',
          'application/zip',
          '*/*',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > FILE_MAX) {
        toast({ message: t('importApps.tooBig') });
        return;
      }
      const bytes = await readPickedBytes(asset);
      const options = {
        today,
        newId: uuidv7,
        names: {
          habitica: 'Habitica',
          habits: t('importApps.habits'),
          dailies: t('importApps.dailies'),
          todos: t('importApps.todos'),
          noSection: t('importApps.noSection'),
          dateNote: t('importApps.dateNote'),
        },
      };
      let plan: ImportPlan | null = null;
      if (/\.zip$/i.test(asset.name)) {
        // Backup do Todoist: um CSV por projeto
        const files = Object.entries(unzipSync(bytes, { filter: (f) => /\.csv$/i.test(f.name) }))
          .map(([name, data]) => ({ name, text: strFromU8(data) }))
          .filter((f) => isTodoistCsv(f.text));
        if (files.length) plan = importTodoist(files, options);
      } else {
        const text = strFromU8(bytes);
        if (isTodoistCsv(text)) plan = importTodoist([{ name: asset.name, text }], options);
        else {
          let data: unknown = null;
          try {
            data = JSON.parse(text);
          } catch {}
          if (isHabiticaExport(data)) plan = importHabitica(data, options);
        }
      }
      if (!plan) {
        toast({ message: t('importApps.unknown') });
        return;
      }
      if (!plan.tasks) {
        toast({ message: t('importApps.empty') });
        return;
      }
      setPreview(plan);
    } catch (err) {
      toast({ message: t('importApps.error', { message: (err as Error).message }) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport(plan: ImportPlan) {
    closePreview();
    setBusy(true);
    let first: string | null = null;
    let created = 0;
    try {
      // Um projeto por vez: cada um é uma chamada, e o que já entrou fica se o seguinte falhar
      for (const project of plan.projects) {
        const id = await m.createFrom.mutateAsync({
          name: project.name,
          icon: project.icon,
          data: projectData(project),
          shared: false,
        });
        first ??= id;
        created++;
      }
      toast({ message: t('importApps.imported', { count: plan.tasks }) });
      if (first) router.push({ pathname: '/folder/[id]', params: { id: first } });
    } catch (err) {
      toast({
        message: t('importApps.partial', {
          done: created,
          total: plan.projects.length,
          message: (err as Error).message,
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-1">
      <Button
        variant="ghost"
        icon={Upload}
        className="self-start"
        label={t('importApps.button')}
        loading={busy}
        disabled={busy || !online}
        onPress={() => void pick()}
      />
      <Text className="text-sm text-ink-muted">{t('importApps.hint')}</Text>
      {preview && (
        <ConfirmDialog
          title={t('importApps.confirmTitle', { count: preview.tasks })}
          message={[
            t(
              preview.source === 'habitica' ? 'importApps.fromHabitica' : 'importApps.fromTodoist',
              {
                count: preview.projects.length,
                names: preview.projects.map((p) => p.name).join(', '),
              },
            ),
            preview.skipped.done
              ? t('importApps.skippedDone', { count: preview.skipped.done })
              : '',
            preview.skipped.rewards
              ? t('importApps.skippedRewards', { count: preview.skipped.rewards })
              : '',
            preview.skipped.overLimit
              ? t('importApps.overLimit', { count: preview.skipped.overLimit })
              : '',
            preview.unreadDates ? t('importApps.unreadDates', { count: preview.unreadDates }) : '',
          ]
            .filter(Boolean)
            .join('\n')}
          confirmLabel={t('importApps.confirm')}
          onClose={closePreview}
          onConfirm={() => void confirmImport(preview)}
        />
      )}
    </View>
  );
}
