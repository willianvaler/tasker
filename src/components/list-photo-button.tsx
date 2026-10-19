import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ActionMenu, useDialog } from '@/components/ui/dialog';
import { normalizeList } from '@/lib/photo-read';
import { PhotoReadError, preparePhoto, readPhoto } from '@/lib/queries/photo-read';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Foto de uma lista de papel vira tarefas (ESCOPO_V9 §3, o OCR do ESCOPO §11 e do V3 §6 C): o
// texto lido entra no campo da criação em lote, com a sintaxe rápida e a pré-visualização de sempre.

export function ListPhotoButton({ onLines }: { onLines: (lines: string[]) => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const [menu, setMenu, closeMenu] = useDialog<true>();
  const [reading, setReading] = useState(false);

  async function pick(camera: boolean) {
    if (!online) return toast({ message: t('listPhoto.offline') });
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return toast({ message: t('attach.noCamera') });
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setReading(true);
    try {
      const photo = await preparePhoto(asset.uri, asset.width, asset.height);
      const { result: raw } = await readPhoto(photo, 'list', i18n.language);
      const lines = normalizeList(raw);
      if (lines.length === 0) toast({ message: t('listPhoto.empty') });
      else {
        onLines(lines);
        toast({ message: t('listPhoto.read', { count: lines.length }) });
      }
    } catch (err) {
      const code = err instanceof PhotoReadError ? err.code : 'failed';
      toast({
        message: t(`expenses.photo.${code}`, {
          limit: err instanceof PhotoReadError ? err.limit : undefined,
        }),
      });
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        icon={Camera}
        className="self-start"
        label={t(reading ? 'listPhoto.reading' : 'listPhoto.button')}
        disabled={reading}
        onPress={() => setMenu(true)}
      />
      {menu && (
        <ActionMenu
          title={t('listPhoto.button')}
          onClose={closeMenu}
          actions={[
            { label: t('expenses.photo.camera'), onPress: () => pick(true) },
            { label: t('expenses.photo.gallery'), onPress: () => pick(false) },
          ]}
        />
      )}
    </>
  );
}
