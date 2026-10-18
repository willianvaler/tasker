import { router, usePathname } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkoutInvites, useWorkoutSessionActions } from '@/lib/queries/workout-session';
import { useIsOnline } from '@/providers/online';

/**
 * "Fulano começou o treino com você: entrar" (V6 §15.4, AC10.1), por cima de qualquer tela
 * enquanto o convite está aberto. Fora do Modo Treino; o aviso também vai para o celular (push).
 */
export function WorkoutInviteBanner() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const pathname = usePathname();
  const inWorkout = pathname.startsWith('/treino/');
  const invites = useWorkoutInvites(online && !inWorkout);
  const { leave } = useWorkoutSessionActions();
  const insets = useSafeAreaInsets();
  const invite = invites.data?.[0];
  if (!invite || inWorkout) return null;
  return (
    <View
      className="absolute left-2 right-2 z-50 flex-row flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 md:left-auto md:w-96"
      style={{ top: insets.top + 8 }}
      role="alert"
    >
      <Icon icon={Dumbbell} tone="ink" />
      <Text className="flex-1 text-sm text-ink">
        {t('together.invite', {
          name: invite.by_name ?? t('common.someone'),
          page: invite.page_name,
        })}
      </Text>
      <View className="flex-row gap-2">
        <Button
          variant="ghost"
          label={t('together.decline')}
          disabled={leave.isPending}
          onPress={() => leave.mutate(invite.session_id)}
        />
        <Button
          label={t('together.join')}
          onPress={() =>
            router.push({
              pathname: '/treino/[id]',
              params: { id: invite.page_id, sessao: invite.session_id },
            })
          }
        />
      </View>
    </View>
  );
}
