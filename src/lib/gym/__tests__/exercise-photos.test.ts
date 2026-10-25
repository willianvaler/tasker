import { describe, expect, it } from '@jest/globals';

import { exercisePhotoPath, hasExercisePhoto } from '../exercise-photos';
import { PLAN_EXERCISES } from '../plans';

describe('fotos dos exercícios (AC3.10)', () => {
  it('sabe quem tem foto, inclusive os que as duas bases juntaram', () => {
    expect(hasExercisePhoto('free-Barbell_Squat')).toBe(true);
    // Remada curvada com barra: veio das duas bases e ficou com o id do dataset MIT
    expect(hasExercisePhoto('mit-0027')).toBe(true);
    expect(hasExercisePhoto('mit-0180')).toBe(false); // só no dataset MIT, sem foto
    expect(hasExercisePhoto(null)).toBe(false);
  });

  it('caminhos no bucket', () => {
    expect(exercisePhotoPath('free-Plank', 0)).toBe('free-Plank/0.jpg');
    expect(exercisePhotoPath('free-Plank', 1, true)).toBe('mini/free-Plank/1.jpg');
  });

  it('quase todo exercício dos planos prontos tem foto', () => {
    const without = PLAN_EXERCISES.filter((id) => !hasExercisePhoto(id));
    expect(without.length).toBeLessThanOrEqual(2);
  });
});
