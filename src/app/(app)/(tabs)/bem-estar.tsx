import { Dumbbell, Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { WorkoutHub } from '@/components/gym/workout-hub';
import { HubRow, HubSection } from '@/components/hub';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Text } from '@/components/ui/text';
import { MedicationsSection } from '@/components/wellness/medications';
import { useGymInWellness, useProfile } from '@/lib/queries/profile';

// Bem-estar (ESCOPO_V10 §5, D270): o que é de saúde num lugar. Os remédios sempre; o Treino entra
// inteiro aqui quando "Academia dentro do Bem-estar" está ligado (Configurações → Recursos), e aí
// sai da barra lateral, da tela Pastas e das posições da barra de baixo. Desligado, fica um atalho.
export default function WellnessScreen() {
  const { t } = useTranslation();
  const gymOn = useProfile().data?.gym_enabled === true;
  const gymInside = useGymInWellness();

  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-8 pb-clear">
        <ScreenHeader
          search
          help="bem-estar"
          eyebrow={t('wellness.eyebrow')}
          title={t('nav.wellness')}
        />
        {gymInside ? (
          <View className="gap-6">
            <Text className="font-serif text-xl text-ink">{t('nav.workout')}</Text>
            <WorkoutHub />
          </View>
        ) : (
          <HubSection>
            <HubRow
              icon={Dumbbell}
              label={t('nav.workout')}
              hint={t(gymOn ? 'wellness.workoutHint' : 'wellness.workoutOffHint')}
              href={gymOn ? '/treino' : '/configuracoes'}
            />
            <HubRow
              icon={Scale}
              label={t('body.title')}
              hint={t('workoutHub.bodyHint')}
              href="/corpo"
            />
          </HubSection>
        )}
        <MedicationsSection />
      </ScreenScroll>
    </Screen>
  );
}
