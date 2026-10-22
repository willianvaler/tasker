import { GymQuestion } from '@/components/gym-question';
import { useProfile, useSetGymMode } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';

/**
 * "Vai usar para treinar?" (V6 §15.1), uma vez por conta: aparece na Hoje enquanto o perfil não
 * respondeu (gym_enabled nulo), depois da introdução. A resposta muda em Configurações → Recursos.
 */
export function GymPrompt() {
  const profile = useProfile();
  const setGymMode = useSetGymMode();
  const online = useIsOnline();
  const data = profile.data;
  if (!data || data.gym_enabled != null || !data.onboarded_at || !online) return null;
  return <GymQuestion busy={setGymMode.isPending} onAnswer={(yes) => setGymMode.mutate(yes)} />;
}
