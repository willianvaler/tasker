import { useTranslation } from 'react-i18next';

import { WorkoutHub } from '@/components/gym/workout-hub';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';

// Treino (D258): os treinos, os grupos e as ferramentas de academia num lugar. No celular,
// Biblioteca, Peso e medidas e Estatísticas não tinham caminho (só existiam no bloco Academia da
// barra lateral, que o celular não mostra). Pode ocupar uma posição da barra de baixo.
export default function WorkoutHubScreen() {
  const { t } = useTranslation();
  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          search
          help="repeticoes-descanso"
          eyebrow={t('workoutHub.eyebrow')}
          title={t('nav.workout')}
        />
        <WorkoutHub />
      </ScreenScroll>
    </Screen>
  );
}
