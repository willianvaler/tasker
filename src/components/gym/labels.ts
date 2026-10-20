import type { TFunction } from 'i18next';

import type { BodyPart, Equipment, Muscle } from '@/lib/gym/exercise-filter';

// Nomes do vocabulário da biblioteca (D235); valor desconhecido aparece como veio.
export const equipmentLabel = (t: TFunction, v: string) =>
  t(`library.equip.${v as Equipment}`, { defaultValue: v });
export const bodyPartLabel = (t: TFunction, v: string) =>
  t(`library.part.${v as BodyPart}`, { defaultValue: v });
export const muscleLabel = (t: TFunction, v: string) =>
  t(`library.muscle.${v as Muscle}`, { defaultValue: v });
