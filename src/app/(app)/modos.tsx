import { router } from 'expo-router';
import { Dumbbell, Hourglass, Play, Timer, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { usePomodoro, useStartTimer } from '@/components/timer-bar';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { pageLabel, useTree, useWorkoutPageIds } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

// Modos (U1, D159): Treino, Foco e Descanso num lugar só. Antes cada um ficava numa tela: o Modo
// Treino no botão da página de cards, o pomodoro no Perfil e na paleta, o descanso só depois de
// uma série. Abre por cima (como o painel da tarefa) pela barra lateral, pelo topo da Hoje no
// celular e pela paleta.

const REST_SECONDS = [30, 60, 90, 120, 180, 300];

/** 30 → "30 s", 90 → "1:30", 120 → "2 min" */
function restLabel(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`;
}

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ModesScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const tree = useTree();
  const pomodoro = usePomodoro();
  const startTimer = useStartTimer();
  const seriesPages = useWorkoutPageIds().data ?? [];
  // W7: as de cards e as que têm tarefa com séries (o Modo Treino serve para as duas)
  const workouts = (tree.data?.pages ?? []).filter(
    (p) => p.view_type === 'cards' || seriesPages.includes(p.id),
  );

  return (
    <Sheet
      onClose={close}
      header={
        <View className="min-h-12 flex-row items-center gap-2 border-b border-line pl-4 pr-2">
          <Text className="flex-1 font-mono text-xs uppercase text-ink-muted">
            {t('modes.title')}
          </Text>
          <IconButton icon={X} label={t('common.close')} onPress={close} />
        </View>
      }
    >
      <Mode icon={Dumbbell} title={t('modes.workout')} hint={t('modes.workoutHint')}>
        {workouts.length === 0 ? (
          <Text className="text-sm text-ink-muted">{t('modes.noWorkout')}</Text>
        ) : (
          workouts.map((page) => (
            <Pressable
              key={page.id}
              accessibilityRole="button"
              accessibilityLabel={t('modes.startWorkout', { page: pageLabel(page) })}
              onPress={() => router.replace({ pathname: '/treino/[id]', params: { id: page.id } })}
              className="min-h-11 flex-row items-center gap-2 rounded px-2 hover:bg-wash active:bg-wash md:min-h-9"
            >
              <Icon icon={Play} tone="accent" />
              <Text className="flex-1 text-base text-ink">{pageLabel(page)}</Text>
            </Pressable>
          ))
        )}
      </Mode>

      <Mode icon={Timer} title={t('modes.focus')} hint={t('modes.focusHint')}>
        <View className="flex-row flex-wrap gap-2">
          <Button
            icon={Play}
            label={t('modes.startFocus', {
              minutes: pomodoro.settings.focus_minutes,
            })}
            onPress={() => {
              void pomodoro.start();
              router.replace('/pomodoro');
            }}
          />
          <Button
            variant="ghost"
            label={t('pomodoro.openSettings')}
            onPress={() => router.replace('/pomodoro')}
          />
        </View>
      </Mode>

      <Mode icon={Hourglass} title={t('modes.rest')} hint={t('modes.restHint')}>
        <View className="flex-row flex-wrap gap-2">
          {REST_SECONDS.map((seconds) => (
            <Chip
              key={seconds}
              label={restLabel(seconds)}
              onPress={() => {
                void startTimer({ kind: 'rest', seconds, config: {} });
                toast({ message: t('modes.restStarted', { time: restLabel(seconds) }) });
                close();
              }}
            />
          ))}
        </View>
      </Mode>
    </Sheet>
  );
}

function Mode({
  icon,
  title,
  hint,
  children,
}: {
  icon: typeof Timer;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2 border-b border-line pb-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={icon} size={20} tone="ink" />
        <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
          {title}
        </Text>
      </View>
      <Text className="text-sm text-ink-muted">{hint}</Text>
      {children}
    </View>
  );
}
