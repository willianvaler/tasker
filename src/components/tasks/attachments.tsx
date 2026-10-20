import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { CloudOff, Download, FileText, Paperclip, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ActionMenu, ConfirmDialog, DialogFrame, useDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { formatBytes, isImage } from '@/lib/attachments';
import { openUrl } from '@/lib/open-url';
import {
  signedUrl,
  useAttachmentMutations,
  useAttachments,
  useSignedUrls,
  type Attachment,
  type PickedFile,
} from '@/lib/queries/attachments';
import { useIsOnline } from '@/providers/online';
import { useIsLocal } from '@/providers/sync';
import { useToast } from '@/providers/toast';

// Anexos no painel da tarefa (N2, D150): miniaturas das imagens, arquivos como linha; tocar abre
// a imagem grande (baixada só agora) ou o arquivo. Anexar e remover pedem conexão e poder editar.

export function Attachments({
  task,
  writable,
}: {
  task: { id: string; folder_id: string | null; page_id: string | null };
  writable: boolean;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const local = useIsLocal();
  const list = useAttachments(task.id);
  const m = useAttachmentMutations(task);
  const items = list.data ?? [];
  const thumbs = useSignedUrls(
    items.filter((a) => a.thumb_path).map((a) => a.thumb_path as string),
  );
  const [menu, setMenu, closeMenu] = useDialog<true>();
  const [viewing, setViewing, closeViewing] = useDialog<Attachment>();
  const [removing, setRemoving, closeRemoving] = useDialog<Attachment>();
  // Sem internet, com o banco no aparelho, o anexo espera na fila (N3)
  const canEdit = writable && (online || local);

  // O último erro fica escrito na seção (o aviso some sozinho e a foto pode demorar a processar)
  const [failure, setFailure] = useState<string | null>(null);
  function send(files: PickedFile[]) {
    setFailure(null);
    for (const file of files)
      m.add.mutateAsync(file).catch((err: Error) => {
        const message = t('attach.failed', { message: err.message });
        setFailure(message);
        toast({ message });
      });
  }

  async function pickImage(camera: boolean) {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return toast({ message: t('attach.noCamera') });
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: !camera,
      selectionLimit: 10,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    send(
      result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? a.file?.name,
        mime: a.mimeType ?? a.file?.type ?? 'image/jpeg',
        size: a.fileSize,
        width: a.width,
        height: a.height,
      })),
    );
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, base64: false });
    if (result.canceled) return;
    send(result.assets.map((a) => ({ uri: a.uri, name: a.name, mime: a.mimeType, size: a.size })));
  }

  async function open(a: Attachment, download = false) {
    try {
      await openUrl(await signedUrl(a.path, download ? a.name : undefined));
    } catch (err) {
      toast({ message: t('attach.failed', { message: (err as Error).message }) });
    }
  }

  function press(a: Attachment) {
    if (a.error) return setRemoving(a);
    if (a.thumb_path || a.preview) return setViewing(a);
    if (!a.pending) open(a);
  }

  const images = items.filter((a) => a.thumb_path || isImage(a.mime));
  const files = items.filter((a) => !(a.thumb_path || isImage(a.mime)));
  return (
    <View className="gap-2">
      {items.length === 0 && !m.add.isPending && (
        <Text className="text-sm text-ink-muted">{t('attach.empty')}</Text>
      )}
      {images.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {images.map((a) => {
            const uri = a.preview ?? (a.thumb_path ? thumbs.data?.[a.thumb_path] : undefined);
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={t('attach.open', { name: a.name })}
                onPress={() => press(a)}
                className="h-20 w-20 overflow-hidden rounded border border-line bg-wash"
              >
                {a.pending && (
                  <View className="absolute bottom-1 right-1 z-10 rounded-full bg-surface p-1">
                    <Icon icon={CloudOff} size={16} tone={a.error ? 'warn' : 'ink-muted'} />
                  </View>
                )}
                {uri ? (
                  <Image
                    source={{ uri, cacheKey: a.pending ? undefined : (a.thumb_path ?? undefined) }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Icon icon={Paperclip} size={20} tone="ink-muted" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      {files.map((a) => (
        <View key={a.id} className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('attach.open', { name: a.name })}
            onPress={() => press(a)}
            className="flex-1 flex-row items-center gap-2"
          >
            {a.pending ? (
              <Icon icon={CloudOff} size={16} tone={a.error ? 'warn' : 'ink-muted'} />
            ) : (
              <Icon icon={FileText} tone="ink-muted" />
            )}
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {a.name}
            </Text>
            <Text className="font-mono text-xs text-ink-muted">
              {formatBytes(a.size, i18n.language)}
            </Text>
          </Pressable>
          {(canEdit || a.pending) && (
            <Button
              destructive
              variant="ghost"
              icon={Trash2}
              label={t('attach.remove')}
              onPress={() => setRemoving(a)}
            />
          )}
        </View>
      ))}
      {m.add.isPending && <Text className="text-sm text-ink-muted">{t('attach.sending')}</Text>}
      {failure && !m.add.isPending && <Text className="text-xs text-warn">{failure}</Text>}
      {items.some((a) => a.pending && !a.error) && (
        <Text className="text-xs text-ink-muted">{t('attach.queued')}</Text>
      )}
      {items.some((a) => a.error) && (
        <Text className="text-xs text-warn">
          {t('attach.rejected', { message: items.find((a) => a.error)?.error ?? '' })}
        </Text>
      )}
      {canEdit && (
        <Button
          variant="ghost"
          icon={Paperclip}
          label={t('attach.add')}
          className="self-start"
          onPress={() => setMenu(true)}
        />
      )}
      {writable && !online && <Text className="text-xs text-ink-muted">{t('attach.offline')}</Text>}

      {menu && (
        <ActionMenu
          title={t('attach.add')}
          onClose={closeMenu}
          actions={[
            { label: t('attach.fromGallery'), onPress: () => pickImage(false) },
            ...(Platform.OS === 'web'
              ? []
              : [{ label: t('attach.fromCamera'), onPress: () => pickImage(true) }]),
            { label: t('attach.fromFiles'), onPress: pickFile },
          ]}
        />
      )}
      {viewing && !removing && (
        <Viewer
          attachment={viewing}
          onClose={closeViewing}
          onOpen={open}
          onRemove={canEdit || viewing.pending ? () => setRemoving(viewing) : undefined}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t('attach.removeTitle')}
          message={removing.name}
          confirmLabel={t('attach.remove')}
          destructive
          onClose={closeRemoving}
          onConfirm={() => {
            m.remove.mutate(removing, {
              onError: (err) => toast({ message: t('attach.failed', { message: err.message }) }),
            });
            closeRemoving();
            closeViewing();
          }}
        />
      )}
    </View>
  );
}

function Viewer({
  attachment,
  onClose,
  onOpen,
  onRemove,
}: {
  attachment: Attachment;
  onClose: () => void;
  onOpen: (a: Attachment, download?: boolean) => void;
  onRemove?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const urls = useSignedUrls(attachment.pending ? [] : [attachment.path]);
  const uri = attachment.pending ? attachment.preview : urls.data?.[attachment.path];
  const ratio =
    attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;
  return (
    <DialogFrame onClose={onClose} wide>
      <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
        {attachment.name}
      </Text>
      <View className="w-full overflow-hidden rounded bg-wash" style={{ aspectRatio: ratio }}>
        {uri ? (
          <Image
            source={{ uri, cacheKey: attachment.pending ? undefined : attachment.path }}
            placeholder={attachment.thumb_path ? { cacheKey: attachment.thumb_path } : undefined}
            contentFit="contain"
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={attachment.name}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-ink-muted">{t('attach.loading')}</Text>
          </View>
        )}
      </View>
      <Text className="font-mono text-xs text-ink-muted">
        {attachment.width && attachment.height ? `${attachment.width}×${attachment.height} · ` : ''}
        {formatBytes(attachment.size, i18n.language)}
      </Text>
      <View className="flex-row flex-wrap justify-end gap-2">
        {onRemove && (
          <Button
            destructive
            variant="ghost"
            icon={Trash2}
            label={t('attach.remove')}
            onPress={onRemove}
          />
        )}
        {!attachment.pending && (
          <Button
            variant="ghost"
            icon={Download}
            label={t('attach.download')}
            onPress={() => onOpen(attachment, true)}
          />
        )}
        <Button label={t('common.close')} onPress={onClose} />
      </View>
    </DialogFrame>
  );
}
