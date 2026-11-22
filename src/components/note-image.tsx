import { Image } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { imagePath } from '@/lib/note-images';
import { useNoteImageUrl } from '@/lib/queries/note-images';

/**
 * Imagem da anotação (ES3, D324): o `![texto](qlimg:...)` desenhado na largura do texto (sem passar
 * do tamanho dela), com o endereço assinado do Storage. Sem conexão ou sem permissão, um aviso no
 * lugar, com o texto da imagem.
 */
export function NoteImage({ refPath, alt }: { refPath: string; alt?: string }) {
  const { t } = useTranslation();
  const { url, error } = useNoteImageUrl(refPath);
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  if (error || failed)
    return (
      <View
        testID="note-image-missing"
        className="my-2 flex-row items-center gap-2 rounded border border-dashed border-line p-3"
      >
        <Icon icon={ImageOff} size={16} tone="ink-muted" />
        <Text className="flex-1 text-sm text-ink-muted">{alt || t('noteImages.unavailable')}</Text>
      </View>
    );
  return (
    <View className="my-2 w-full" testID="note-image">
      <Image
        source={url ? { uri: url, cacheKey: imagePath(refPath) } : undefined}
        accessibilityLabel={alt || t('noteImages.image')}
        contentFit="contain"
        onLoad={(e) => setRatio(e.source.width / Math.max(1, e.source.height))}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          aspectRatio: ratio ?? 4 / 3,
          maxHeight: 640,
          borderRadius: 6,
        }}
      />
      {alt ? <Text className="mt-1 text-xs text-ink-muted">{alt}</Text> : null}
    </View>
  );
}
