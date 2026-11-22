import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { FileText, NotebookText, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { formatBytes } from '@/lib/attachments';
import { materialTitle, planMaterials } from '@/lib/materials';
import {
  addNoteMaterials,
  sendMaterialPdf,
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

// Material da pasta ou projeto (ES4, D325): os arquivos de estudo na ordem do nome. O PDF abre no
// leitor (/material/<id>); o `.md` virou anotação da pasta e abre como anotação.

type Picked = DocumentPicker.DocumentPickerAsset;

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
    const plan = planMaterials(result.assets);
    let added = 0;
    let failed = 0;
    try {
      // .md: anotações da pasta, com as imagens escolhidas junto (as que o texto cita)
      if (plan.markdown.length) {
        setProgress(t('materials.reading'));
        const files = await Promise.all(
          plan.markdown.map(async (f) => ({
            path: f.name,
            text: new TextDecoder().decode(await readPickedBytes(f)),
          })),
        );
        const parsed = importVault(files, {
          newId: uuidv7,
          existing: (notes.data ?? []).map((n) => ({ id: n.id, title: noteTitle(n, '') })),
          imageFiles: plan.images.map((f) => f.name),
        });
        await m.createMany.mutateAsync(parsed.notes.map((n) => ({ ...n, folderId })));
        setProgress(t('vault.imagesWaiting'));
        if (!(await waitForNotesOnServer(parsed.notes.map((n) => n.id))))
          throw new Error(t('materials.notesWaiting'));
        await addNoteMaterials(
          folderId,
          parsed.notes.map((n, i) => ({
            noteId: n.id,
            name:
              plan.markdown.find((f) => materialTitle(f.name.split('/').pop() ?? '') === n.title)
                ?.name ??
              plan.markdown[i]?.name ??
              `${n.title}.md`,
          })),
        );
        added += parsed.notes.length;
        const byName = new Map<string, Picked>(plan.images.map((f) => [f.name, f]));
        let sent = 0;
        for (const image of parsed.images) {
          const file = byName.get(image.file);
          try {
            if (!file) throw new Error('missing');
            await sendNoteImage({
              id: image.id,
              noteId: image.noteId,
              body: await readPickedBytes(file),
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
      // PDFs: um de cada vez (podem ter 50 MB)
      let done = 0;
      for (const pdf of plan.pdfs) {
        setProgress(t('materials.sending', { done: ++done, total: plan.pdfs.length }));
        try {
          await sendMaterialPdf(folderId, pdf);
          added++;
        } catch (err) {
          failed++;
          toast({ message: t('materials.failed', { name: pdf.name, message: (err as Error).message }) });
        }
      }
      const left = plan.skipped.length + plan.tooBig.length;
      toast({
        message: [
          t('materials.added', { count: added }),
          plan.tooBig.length ? t('materials.tooBigCount', { count: plan.tooBig.length }) : null,
          left - plan.tooBig.length > 0
            ? t('materials.skipped', { count: left - plan.tooBig.length })
            : null,
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

export function openMaterial(material: Material) {
  if (material.kind === 'note' && material.note_id)
    router.push({ pathname: '/nota/[id]', params: { id: material.note_id } });
  else router.push({ pathname: '/material/[id]', params: { id: material.id } });
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
        <View key={material.id} className="min-h-11 flex-row items-center hover:bg-wash md:min-h-10">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={materialTitle(material.name)}
            className="flex-1 flex-row items-center gap-3 px-2 py-2"
            onPress={() => openMaterial(material)}
          >
            <Icon icon={material.kind === 'note' ? NotebookText : FileText} tone="ink-muted" />
            <View className="flex-1">
              <Text className="text-sm text-ink" numberOfLines={2}>
                {materialTitle(material.name)}
              </Text>
              <Text className="text-xs text-ink-muted">
                {material.kind === 'note'
                  ? t('materials.kindNote')
                  : t('materials.kindPdf', { size: formatBytes(material.size ?? 0, i18n.language) })}
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
