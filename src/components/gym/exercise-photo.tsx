import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { exercisePhotoPath, hasExercisePhoto, PHOTO_BUCKET } from '@/lib/gym/exercise-photos';
import { supabase } from '@/lib/supabase';

const FRAME_MS = 1100;

function photoUrl(id: string, frame: 0 | 1, mini: boolean) {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(exercisePhotoPath(id, frame, mini)).data
    .publicUrl;
}

/**
 * Foto do exercício (AC3.10, D274): as duas fotos da free-exercise-db, posição inicial e final,
 * alternando como uma animação curta. Com "reduzir movimento", fica parada na inicial. Sem foto (o
 * exercício não está na base, ou o servidor ainda não subiu as fotos), não ocupa espaço.
 */
export function ExercisePhoto({
  exerciseId,
  name,
  mini = false,
  animate = true,
  className,
}: {
  exerciseId: string | null | undefined;
  name: string;
  /** Miniatura (160 px) para listas e cards; a outra tem 480 px */
  mini?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState<0 | 1>(0);
  const [failed, setFailed] = useState(false);
  const moving = animate && !reduced && !failed;

  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), FRAME_MS);
    return () => clearInterval(id);
  }, [moving]);

  if (!hasExercisePhoto(exerciseId) || failed) return null;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('library.photo', { name })}
      className={cn('overflow-hidden rounded bg-wash', className)}
      style={{ aspectRatio: 3 / 2 }}
    >
      {/* As duas carregadas uma sobre a outra: trocar não pisca nem espera a rede */}
      {([0, 1] as const).map((f) => (
        <Image
          key={f}
          source={{ uri: photoUrl(exerciseId, f, mini) }}
          style={{ position: 'absolute', inset: 0, opacity: (moving ? frame : 0) === f ? 1 : 0 }}
          contentFit="cover"
          cachePolicy="disk"
          transition={0}
          onError={() => setFailed(true)}
          accessible={false}
        />
      ))}
    </View>
  );
}
