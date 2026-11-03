import * as DocumentPicker from 'expo-document-picker';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { Download, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { saveFile } from '@/lib/download';
import { noteTitle, useNoteMutations, useNotes } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { readPickedBytes } from '@/lib/read-bytes';
import { uuidv7 } from '@/lib/uuid';
import { exportVault, importVault, type ImportResult, type VaultFile } from '@/lib/vault';
import { useToast } from '@/providers/toast';

// Importar e exportar o cofre do Obsidian (OB13, D298): um .zip com um .md por anotação. Lê e
// monta o .zip no aparelho (fflate); só as anotações novas vão para o banco.

/** Arquivo grande demais para abrir no celular */
const ZIP_MAX = 50 * 1024 * 1024;

export function VaultActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const notes = useNotes({ templates: 'include' });
  const tree = useTree();
  const today = useToday();
  const m = useNoteMutations();
  const [busy, setBusy] = useState<'import' | 'export' | null>(null);
  const [preview, setPreview, closePreview] = useDialog<ImportResult>();

  async function pick() {
    setBusy('import');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!/\.zip$/i.test(asset.name)) {
        toast({ message: t('vault.notZip') });
        return;
      }
      if ((asset.size ?? 0) > ZIP_MAX) {
        toast({ message: t('vault.tooBig') });
        return;
      }
      const bytes = await readPickedBytes(asset);
      const names: string[] = [];
      // Só abre os .md (as imagens do cofre não são lidas, só contadas)
      const unzipped = unzipSync(bytes, {
        filter: (file) => {
          names.push(file.name);
          return /\.md$/i.test(file.name);
        },
      });
      const files: VaultFile[] = names.map((path) => ({
        path,
        text: unzipped[path] ? strFromU8(unzipped[path]) : '',
      }));
      const parsed = importVault(files, {
        newId: uuidv7,
        existing: (notes.data ?? []).map((n) => ({ id: n.id, title: noteTitle(n, '') })),
      });
      if (!parsed.notes.length) {
        toast({ message: t('vault.empty') });
        return;
      }
      setPreview(parsed);
    } catch (err) {
      toast({ message: t('vault.error', { message: (err as Error).message }) });
    } finally {
      setBusy(null);
    }
  }

  function confirmImport(result: ImportResult) {
    closePreview();
    setBusy('import');
    m.createMany
      .mutateAsync(result.notes)
      .then(() => toast({ message: t('vault.imported', { count: result.notes.length }) }))
      .catch((err: Error) => toast({ message: t('vault.error', { message: err.message }) }))
      .finally(() => setBusy(null));
  }

  async function exportAll() {
    if (!notes.data || !tree.data) return;
    setBusy('export');
    try {
      const dirOf = new Map<string, string[]>();
      for (const root of tree.data.folders) {
        dirOf.set(root.id, [root.name]);
        for (const child of root.children) dirOf.set(child.id, [root.name, child.name]);
      }
      const pages = new Map(tree.data.pages.map((p) => [p.id, pageLabel(p)]));
      const folders = new Map([...dirOf].map(([id, path]) => [id, path.at(-1) ?? '']));
      const files = exportVault(
        notes.data.map((n) => ({
          id: n.id,
          title: noteTitle(n, t('notes.untitled')),
          body: n.body,
          props: n.props ?? {},
          dir: n.is_template
            ? [t('vault.templatesDir')]
            : n.folder_id
              ? (dirOf.get(n.folder_id) ?? [])
              : [],
        })),
        {
          untitled: t('notes.untitled'),
          resolve: (kind, id) =>
            kind === 'page' ? pages.get(id) : kind === 'folder' ? folders.get(id) : null,
        },
      );
      const zip = zipSync(Object.fromEntries(files.map((f) => [f.path, strToU8(f.text)])));
      await saveFile(`questlist-${today}.zip`, zip, 'application/zip');
      toast({ message: t('vault.exported', { count: files.length }) });
    } catch (err) {
      toast({ message: t('vault.error', { message: (err as Error).message }) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      <Button
        variant="ghost"
        icon={Upload}
        label={t('vault.import')}
        loading={busy === 'import'}
        disabled={!!busy}
        onPress={() => void pick()}
      />
      <Button
        variant="ghost"
        icon={Download}
        label={t('vault.export')}
        loading={busy === 'export'}
        // As pastas dão o caminho de cada anotação no cofre: espera a árvore
        disabled={!!busy || !notes.data?.length || !tree.data}
        onPress={() => void exportAll()}
      />
      {preview && (
        <ConfirmDialog
          title={t('vault.confirmTitle', { count: preview.notes.length })}
          message={[
            t('vault.confirmBody'),
            preview.unresolved ? t('vault.unresolved', { count: preview.unresolved }) : '',
            preview.skippedFiles ? t('vault.skippedFiles', { count: preview.skippedFiles }) : '',
            preview.truncated ? t('vault.truncated', { count: preview.truncated }) : '',
            preview.overLimit ? t('vault.overLimit', { count: preview.overLimit }) : '',
            preview.droppedProps ? t('vault.droppedProps', { count: preview.droppedProps }) : '',
          ]
            .filter(Boolean)
            .join('\n')}
          confirmLabel={t('vault.confirm')}
          onClose={closePreview}
          onConfirm={() => confirmImport(preview)}
        />
      )}
    </View>
  );
}
