import * as DocumentPicker from 'expo-document-picker';
import { unzipSync } from 'fflate';
import { router } from 'expo-router';
import { AppWindow, Download, FileText, NotebookText, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Button, IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { formatBytes } from '@/lib/attachments';
import { saveMaterialOffline } from '@/lib/material-cache';
import { ignoredZipPath, buildMaterialImport } from '@/lib/material-import';
import { materialKindOf, materialTitle, planMaterials } from '@/lib/materials';
import {
  addNoteMaterials,
  sendMaterialFile,
  useMaterialMutations,
  useMaterials,
  type Material,
} from '@/lib/queries/materials';
import { sendNoteImage, waitForNotesOnServer } from '@/lib/queries/note-images';
import { noteTitle, useNoteMutations, useNotes } from '@/lib/queries/notes';
import { readPickedBytes } from '@/lib/read-bytes';
import { uuidv7 } from '@/lib/uuid';
import { importVault } from '@/lib/vault';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Material da pasta ou projeto (ES4/ES5, D325/D326): os arquivos de estudo na ordem do nome. O PDF
// e o HTML interativo abrem no leitor (/material/<id>); o `.md` e o HTML com texto viraram
// anotações da pasta e abrem como anotação.

/** Um arquivo para entrar: escolhido no aparelho ou de dentro de um .zip */
type Entry = {
  name: string;
  size?: number | null;
  mime?: string | null;
  read: () => Promise<Uint8Array>;
};
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** Abre o .zip: cada arquivo vira uma entrada, com o caminho dentro dele */
async function unzipEntries(zip: Entry): Promise<Entry[]> {
  // Os que não entram nem são abertos, mas contam no "ficaram de fora"
  const left: string[] = [];
  const files = unzipSync(await zip.read(), {
    filter: (f) => {
      if (ignoredZipPath(f.name)) return false;
      const kind = materialKindOf(f.name);
      if (kind === 'other' || kind === 'zip') left.push(f.name);
      return kind !== 'other' && kind !== 'zip';
    },
  });
  return [
    ...Object.entries(files).map(([path, data]) => ({
      name: path,
      size: data.byteLength,
      read: async () => data,
    })),
    ...left.map((path) => ({
      name: path,
      read: async (): Promise<Uint8Array> => {
        throw new Error('skipped');
      },
    })),
  ];
}

export function useAddMaterials(folderId: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const notes = useNotes({ templates: 'include' });
  const m = useNoteMutations();
  const { settle } = useMaterialMutations(folderId);
  const [progress, setProgress] = useState<string | null>(null);

  async function add() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets.length) return;
    let added = 0;
    let failed = 0;
    let interactiveCount = 0;
    try {
      setProgress(t('materials.reading'));
      const picked: Entry[] = result.assets.map((a) => ({
        name: a.name,
        size: a.size,
        mime: a.mimeType,
        read: () => readPickedBytes(a),
      }));
      const first = planMaterials(picked);
      const fromZips = (await Promise.all(first.zips.map(unzipEntries))).flat();
      // .zip dentro do .zip fica de fora
      const plan = planMaterials([...picked.filter((e) => !first.zips.includes(e)), ...fromZips]);
      plan.skipped.push(...plan.zips);

      // .md e HTML com texto: anotações da pasta (com as imagens que eles citam)
      const texts = async (list: Entry[]) =>
        Promise.all(list.map(async (e) => ({ path: e.name, text: decode(await e.read()) })));
      const built = buildMaterialImport({
        markdown: await texts(plan.markdown),
        html: await texts(plan.html),
      });
      if (built.vault.length) {
        const parsed = importVault(built.vault, {
          newId: uuidv7,
          existing: (notes.data ?? []).map((n) => ({ id: n.id, title: noteTitle(n, '') })),
          imageFiles: plan.images.map((f) => f.name),
        });
        await m.createMany.mutateAsync(parsed.notes.map((n) => ({ ...n, folderId })));
        setProgress(t('vault.imagesWaiting'));
        if (!(await waitForNotesOnServer(parsed.notes.map((n) => n.id))))
          throw new Error(t('materials.notesWaiting'));
        // Só a anotação principal de cada material entra na lista (as partes do livro, não)
        const byTitle = new Map(parsed.notes.map((n) => [n.title, n.id]));
        const rows = built.mains.flatMap((main) => {
          const noteId = byTitle.get(main.title);
          return noteId ? [{ noteId, name: main.name }] : [];
        });
        await addNoteMaterials(folderId, rows);
        added += rows.length;
        const byName = new Map(plan.images.map((f) => [f.name, f]));
        let sent = 0;
        for (const image of parsed.images) {
          const file = byName.get(image.file);
          try {
            if (!file) throw new Error('missing');
            await sendNoteImage({
              id: image.id,
              noteId: image.noteId,
              body: await file.read(),
              mime: image.mime,
              ext: image.ref.split('.').pop() ?? 'png',
              name: image.name,
            });
          } catch {
            failed++;
          }
          setProgress(t('vault.imagesSending', { done: ++sent, total: parsed.images.length }));
        }
      }
      // PDFs e HTML interativo: um de cada vez (podem ter 50 MB)
      const htmlByPath = new Map(plan.html.map((e) => [e.name, e]));
      const uploads = [
        ...plan.pdfs.map((e) => ({
          entry: e,
          name: e.name.split('/').pop() ?? e.name,
          kind: 'pdf' as const,
        })),
        ...built.interactive.flatMap((i) => {
          const entry = htmlByPath.get(i.path);
          return entry ? [{ entry, name: i.name, kind: 'html' as const }] : [];
        }),
      ];
      let done = 0;
      for (const upload of uploads) {
        setProgress(t('materials.sending', { done: ++done, total: uploads.length }));
        try {
          await sendMaterialFile(folderId, {
            name: upload.name,
            body: await upload.entry.read(),
            kind: upload.kind,
          });
          added++;
          if (upload.kind === 'html') interactiveCount++;
        } catch (err) {
          failed++;
          toast({
            message: t('materials.failed', { name: upload.name, message: (err as Error).message }),
          });
        }
      }
      toast({
        message: [
          t('materials.added', { count: added }),
          interactiveCount ? t('materials.interactiveCount', { count: interactiveCount }) : null,
          plan.tooBig.length ? t('materials.tooBigCount', { count: plan.tooBig.length }) : null,
          plan.skipped.length ? t('materials.skipped', { count: plan.skipped.length }) : null,
          failed ? t('materials.failedCount', { count: failed }) : null,
        ]
          .filter(Boolean)
          .join(' '),
      });
    } catch (err) {
      toast({ message: t('vault.error', { message: (err as Error).message }) });
    } finally {
      setProgress(null);
      settle();
    }
  }

  return { add, progress };
}

/**
 * Abre o material na tela de leitura (ES7): o PDF e o HTML no leitor, a anotação em leitura (com
 * Editar). Com a tarefa, o anterior/próximo segue o material dela e a sessão aparece embaixo
 */
export function openMaterial(material: { id: string }, taskId?: string) {
  router.push({
    pathname: '/material/[id]',
    params: taskId ? { id: material.id, tarefa: taskId } : { id: material.id },
  });
}

/** A seção da pasta: aparece com material, ou para quem pode acrescentar quando há o botão */
export function MaterialsSection({
  folderId,
  writable,
  adder,
}: {
  folderId: string;
  writable: boolean;
  adder: ReturnType<typeof useAddMaterials>;
}) {
  const { t, i18n } = useTranslation();
  const online = useIsOnline();
  const materials = useMaterials(folderId);
  const { remove } = useMaterialMutations(folderId);
  const [confirm, setConfirm, closeConfirm] = useDialog<Material>();
  const list = materials.data ?? [];
  // Ler sem internet (ES7): o PDF e o HTML vão para o aparelho de uma vez (as anotações já vão pelo sync)
  const files = list.filter((m) => m.path);
  const filesSize = files.reduce((sum, m) => sum + (m.size ?? 0), 0);
  const [offline, setOffline, closeOffline] = useDialog<true>();
  const [saving, setSaving] = useState<string | null>(null);
  const toast = useToast();
  async function saveAll() {
    closeOffline();
    let failed = 0;
    for (const [i, m] of files.entries()) {
      setSaving(t('study.offlineSaving', { done: i + 1, total: files.length }));
      await saveMaterialOffline(m.path ?? '').catch(() => failed++);
    }
    setSaving(null);
    toast({
      message: failed ? t('study.offlineFailed', { count: failed }) : t('study.offlineDone'),
    });
  }
  if (!list.length && !adder.progress) return null;

  return (
    <View className="mb-2" testID="materials">
      <SectionLabel
        title={t('materials.title')}
        count={list.length}
        right={
          writable && online ? (
            <IconButton
              icon={Plus}
              label={t('materials.add')}
              onPress={() => void adder.add()}
              disabled={!!adder.progress}
            />
          ) : undefined
        }
      />
      {adder.progress && (
        <Text className="px-2 pb-2 text-sm text-ink-muted" accessibilityLiveRegion="polite">
          {adder.progress}
        </Text>
      )}
      {list.map((material) => (
        <View
          key={material.id}
          className="min-h-11 flex-row items-center hover:bg-wash md:min-h-10"
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={materialTitle(material.name)}
            className="flex-1 flex-row items-center gap-3 px-2 py-2"
            onPress={() => openMaterial(material)}
          >
            <Icon
              icon={
                material.kind === 'note'
                  ? NotebookText
                  : material.mime === 'text/html'
                    ? AppWindow
                    : FileText
              }
              tone="ink-muted"
            />
            <View className="flex-1">
              <Text className="text-sm text-ink" numberOfLines={2}>
                {materialTitle(material.name)}
              </Text>
              <Text className="text-xs text-ink-muted">
                {material.kind === 'note'
                  ? t('materials.kindNote')
                  : t(material.mime === 'text/html' ? 'materials.kindHtml' : 'materials.kindPdf', {
                      size: formatBytes(material.size ?? 0, i18n.language),
                    })}
              </Text>
            </View>
          </Pressable>
          {writable && online && (
            <IconButton
              icon={Trash2}
              label={t('materials.remove', { name: materialTitle(material.name) })}
              onPress={() => setConfirm(material)}
            />
          )}
        </View>
      ))}
      {files.length > 0 && online && (
        <View className="flex-row flex-wrap items-center gap-2 px-2 pt-1">
          <Button
            variant="ghost"
            icon={Download}
            label={`${t('study.offline')} · ${formatBytes(filesSize, i18n.language)}`}
            disabled={!!saving}
            onPress={() => setOffline(true)}
          />
          {saving && (
            <Text className="text-sm text-ink-muted" accessibilityLiveRegion="polite">
              {saving}
            </Text>
          )}
        </View>
      )}
      {offline && (
        <ConfirmDialog
          title={t('study.offline')}
          message={t('study.offlineConfirm', {
            count: files.length,
            size: formatBytes(filesSize, i18n.language),
          })}
          confirmLabel={t('study.offline')}
          onClose={closeOffline}
          onConfirm={() => void saveAll()}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={t('materials.removeTitle')}
          message={t(confirm.kind === 'note' ? 'materials.removeNoteHint' : 'materials.removeHint')}
          confirmLabel={t('materials.removeConfirm')}
          destructive
          onClose={closeConfirm}
          onConfirm={() => {
            remove.mutate(confirm);
            closeConfirm();
          }}
        />
      )}
    </View>
  );
}
