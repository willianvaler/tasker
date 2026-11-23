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
import { useMaterialImporter, type MaterialEntry } from '@/components/materials-section';
import { formatBytes } from '@/lib/attachments';
import { groupHtml } from '@/lib/html-book';
import {
  importHabitica,
  importTodoist,
  isHabiticaExport,
  isTodoistCsv,
  projectData,
  projectTitles,
  type ImportPlan,
} from '@/lib/import-apps';
import { ignoredZipPath } from '@/lib/material-import';
import { bestProjectFor, matchMaterials, materialKindOf, MAX_ZIP_BYTES } from '@/lib/materials';
import { useTreeMutations } from '@/lib/queries/tree';
import { useToday } from '@/lib/queries/profile';
import { useTemplateMutations } from '@/lib/queries/projects';
import { readPickedBytes } from '@/lib/read-bytes';
import { uuidv7 } from '@/lib/uuid';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Importar do Habitica e do Todoist (PC1, D306): lê o arquivo no aparelho, mostra o que vai entrar
// e cria um projeto pessoal por origem (pelo create_from_template, como os kits). Plano de estudos
// inteiro (ES8, D330): o .zip com o CSV e a pasta do material cria o projeto já como plano de
// estudos e põe o material nele (ligado pelos códigos); com vários CSVs, o material vai para o
// projeto que casa com mais códigos.

/** O material que veio no .zip: para qual projeto e o resumo da prévia */
type MaterialPlan = {
  entries: MaterialEntry[];
  project: number;
  count: number;
  linked: number;
  unlinked: number;
  size: number;
};
type Plan = ImportPlan & { material?: MaterialPlan };

const baseName = (path: string) => path.split('/').pop() ?? path;

/** Os nomes que viram material (o livro em HTML conta uma vez) */
function materialNames(entries: readonly MaterialEntry[]) {
  const kinds = entries.map((e) => ({ e, kind: materialKindOf(e.name) }));
  const html = kinds.filter((k) => k.kind === 'html').map((k) => ({ path: k.e.name, html: '' }));
  return [
    ...kinds
      .filter((k) => k.kind === 'markdown' || k.kind === 'pdf')
      .map((k) => baseName(k.e.name)),
    ...groupHtml(html).map((g) => (g.book ? g.name : baseName(g.pages[0].path))),
  ];
}

/** Arquivo grande demais para abrir no celular */
const FILE_MAX = 30 * 1024 * 1024;

export function ImportApps() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const online = useIsOnline();
  const m = useTemplateMutations();
  const treeMutations = useTreeMutations();
  const importer = useMaterialImporter();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview, closePreview] = useDialog<Plan>();

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
      const zip = /\.zip$/i.test(asset.name);
      if ((asset.size ?? 0) > (zip ? MAX_ZIP_BYTES : FILE_MAX)) {
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
      let plan: Plan | null = null;
      if (zip) {
        // Backup do Todoist (um CSV por projeto) ou plano de estudos (CSV + a pasta do material)
        const files = unzipSync(bytes, {
          filter: (f) =>
            !ignoredZipPath(f.name) &&
            (/\.csv$/i.test(f.name) || materialKindOf(f.name) !== 'other'),
        });
        const csvs = Object.entries(files)
          .filter(([name]) => /\.csv$/i.test(name))
          .map(([name, data]) => ({ name, text: strFromU8(data) }))
          .filter((f) => isTodoistCsv(f.text));
        if (csvs.length) plan = importTodoist(csvs, options);
        const entries: MaterialEntry[] = Object.entries(files)
          .filter(([name]) => !/\.csv$/i.test(name) && materialKindOf(name) !== 'zip')
          .map(([name, data]) => ({ name, size: data.byteLength, read: async () => data }));
        const names = materialNames(entries);
        if (plan && names.length) {
          const titles = plan.projects.map(projectTitles);
          const project = bestProjectFor(names, titles);
          plan.material = {
            entries,
            project,
            count: names.length,
            ...matchMaterials(names, titles[project] ?? []),
            size: entries.reduce((sum, e) => sum + (e.size ?? 0), 0),
          };
        }
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

  async function confirmImport(plan: Plan) {
    closePreview();
    setBusy(true);
    let first: string | null = null;
    let created = 0;
    try {
      // Um projeto por vez: cada um é uma chamada, e o que já entrou fica se o seguinte falhar
      let study: string | null = null;
      for (const [i, project] of plan.projects.entries()) {
        const id = await m.createFrom.mutateAsync({
          name: project.name,
          icon: project.icon,
          data: projectData(project),
          shared: false,
          // Projeto pessoal (D306), não pasta
          project: true,
        });
        first ??= id;
        if (plan.material?.project === i) study = id;
        created++;
      }
      toast({ message: t('importApps.imported', { count: plan.tasks }) });
      // Plano de estudos (ES8): o projeto do material liga o interruptor e recebe o material
      if (study && plan.material) {
        await treeMutations.setFolderSettings.mutateAsync({ id: study, study: true });
        // O progresso aparece aqui; no fim, abre o projeto
        await importer.importEntries(study, plan.material.entries);
        router.push({ pathname: '/folder/[id]', params: { id: study } });
        return;
      }
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
      {importer.progress && (
        <Text className="text-sm text-ink-muted" accessibilityLiveRegion="polite">
          {importer.progress}
        </Text>
      )}
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
            preview.material
              ? t('importApps.material', {
                  count: preview.material.count,
                  size: formatBytes(preview.material.size, i18n.language),
                  project: preview.projects[preview.material.project]?.name ?? '',
                  linked: preview.material.linked,
                  unlinked: preview.material.unlinked,
                })
              : '',
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
