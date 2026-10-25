import ids from './exercise-photos.json';

// Fotos dos exercícios (AC3.10, D274): quais exercícios do catálogo têm as duas fotos da
// free-exercise-db (lista gerada por scripts/exercicios/fotos.mjs) e onde ficam no bucket.

const WITH_PHOTO = new Set<string>(ids);

export const PHOTO_BUCKET = 'exercise-photos';

export function hasExercisePhoto(id: string | null | undefined): id is string {
  return !!id && WITH_PHOTO.has(id);
}

/** Caminho no bucket: posição inicial (0) ou final (1); a miniatura tem 160 px, a outra 480. */
export function exercisePhotoPath(id: string, frame: 0 | 1, mini = false) {
  return `${mini ? 'mini/' : ''}${id}/${frame}.jpg`;
}
