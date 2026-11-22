import * as DocumentPicker from 'expo-document-picker';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { Download, Upload } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { saveFile } from '@/lib/download';
import { isSharedWithMe, noteTitle, useNoteMutations, useNotes } from '@/lib/queries/notes';
import { useSession } from '@/providers/session';
import { useToday } from '@/lib/queries/profile';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { readPickedBytes } from '@/lib/read-bytes';
import { uuidv7 } from '@/lib/uuid';
import {
  EXPORT_IMAGE_DIR,
  exportVault,
  importVault,
  type ImportResult,
  type VaultFile,
} from '@/lib/vault';
import { imagePath, isImageFile, noteImageRefs } from '@/lib/note-images';
import { signedUrl } from '@/lib/queries/attachments';
import { sendNoteImage, waitForNotesOnServer } from '@/lib/queries/note-images';
import { useToast } from '@/providers/toast';

// Importar e exportar o cofre do Obsidian (OB13, D298): um .zip com um .md por anotação. Lê e
// monta o .zip no aparelho (fflate); só as anotações novas vão para o banco. As imagens citadas
// pelas anotações vão junto (ES3, D324): sobem depois que as anotações chegam ao servidor e, ao
// exportar, voltam na pasta "anexos".

/** Quantas imagens sobem ou descem ao mesmo tempo */
const PARALLEL = 4;

async function eachLimited<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}

/** Arquivo grande demais para abrir no celular */
const ZIP_MAX = 50 * 1024 * 1024;

export function VaultActions() {
  const { t } = useTranslation();
  const toast = useToast();
  const notes = useNotes({ templates: 'include' });
  const me = useSession().session?.user.id;
  const tree = useTree();
  const today = useToday();
  const m = useNoteMutations();
  const [busy, setBusy] = useState<'import' | 'export' | null>(null);
  const [preview, setPreview, closePreview] = useDialog<ImportResult>();
  // Os bytes das imagens do .zip, entre a prévia e o confirmar
  const imageBytes = useRef(new Map<string, Uint8Array>());
  const [progress, setProgress] = useState<string | null>(null);

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
      // Abre os .md e as imagens (as que nenhuma anotação cita ficam de fora depois)
      const unzipped = unzipSync(bytes, {
        filter: (file) => {
          names.push(file.name);
          return /\.md$/i.test(file.name) || isImageFile(file.name);
        },
      });
      const files: VaultFile[] = names
        .filter((path) => !isImageFile(path))
        .map((path) => ({
          path,
          text: unzipped[path] ? strFromU8(unzipped[path]) : '',
        }));
      const parsed = importVault(files, {
        newId: uuidv7,
        existing: (notes.data ?? []).map((n) => ({ id: n.id, title: noteTitle(n, '') })),
        imageFiles: names.filter(isImageFile),
      });
      imageBytes.current = new Map(
        parsed.images.flatMap((i) => (unzipped[i.file] ? [[i.file, unzipped[i.file]]] : [])),
      );
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
      .then(async () => {
        toast({ message: t('vault.imported', { count: result.notes.length }) });
        if (result.images.length) await sendImages(result);
      })
      .catch((err: Error) => toast({ message: t('vault.error', { message: err.message }) }))
      .finally(() => {
        setBusy(null);
        setProgress(null);
        imageBytes.current = new Map();
      });
  }

  /** As imagens sobem depois que as anotações chegam ao servidor (a permissão é a da anotação) */
  async function sendImages(result: ImportResult) {
    setProgress(t('vault.imagesWaiting'));
    const noteIds = [...new Set(result.images.map((i) => i.noteId))];
    if (!(await waitForNotesOnServer(noteIds))) {
      toast({ message: t('vault.imagesFailed', { count: result.images.length }) });
      return;
    }
    let done = 0;
    let failed = 0;
    await eachLimited(result.images, async (image) => {
      const bytes = imageBytes.current.get(image.file);
      try {
        if (!bytes) throw new Error('missing');
        await sendNoteImage({
          id: image.id,
          noteId: image.noteId,
          body: bytes,
          mime: image.mime,
          ext: image.ref.split('.').pop() ?? 'png',
          name: image.name,
        });
      } catch {
        failed++;
      }
      done++;
      setProgress(t('vault.imagesSending', { done, total: result.images.length }));
    });
    toast({
      message: failed
        ? t('vault.imagesFailed', { count: failed })
        : t('vault.imagesSent', { count: result.images.length }),
    });
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
            : isSharedWithMe(n, me)
              ? [t('vault.sharedDir')]
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
      // Imagens das anotações (ES3): baixadas e postas na pasta "anexos"
      const refs = [...new Set(notes.data.flatMap((n) => noteImageRefs(n.body)))];
      const images: [string, Uint8Array][] = [];
      let missing = 0;
      await eachLimited(refs, async (ref) => {
        try {
          const res = await fetch(await signedUrl(imagePath(ref)));
          if (!res.ok) throw new Error(String(res.status));
          images.push([
            `${EXPORT_IMAGE_DIR}/${ref.split('/').pop()}`,
            new Uint8Array(await res.arrayBuffer()),
          ]);
        } catch {
          missing++;
        }
      });
      if (missing) toast({ message: t('vault.imagesMissing', { count: missing }) });
      const zip = zipSync({
        ...Object.fromEntries(files.map((f) => [f.path, strToU8(f.text)])),
        ...Object.fromEntries(images),
      });
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
      {progress && <Text className="w-full text-xs text-ink-muted">{progress}</Text>}
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
            preview.images.length ? t('vault.images', { count: preview.images.length }) : '',
            preview.missingImages ? t('vault.missingImages', { count: preview.missingImages }) : '',
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
