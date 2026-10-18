import { View } from 'react-native';

import { GymQuestion } from '@/components/gym-question';
import { useProfile, useSetGymMode } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';

/**
 * "Vai usar para treinar?" (V6 §15.1), uma vez por conta: aparece no Início enquanto o perfil não
 * respondeu (gym_enabled nulo), depois da introdução. A resposta muda no Perfil a qualquer hora.
 */
export function GymPrompt() {
  const profile = useProfile();
  const setGymMode = useSetGymMode();
  const online = useIsOnline();
  const data = profile.data;
  if (!data || data.gym_enabled != null || !data.onboarded_at || !online) return null;
  return (
    <View className="mt-4 rounded-lg border border-line bg-surface p-4">
      <GymQuestion busy={setGymMode.isPending} onAnswer={(yes) => setGymMode.mutate(yes)} />
    </View>
  );
}
