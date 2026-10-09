import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { cn } from '@/lib/cn';
import { useGameState, type Boss, type GameState } from '@/lib/queries/game';

/** Barra de progresso que anda suave quando o valor muda (animação curta ao concluir, ESCOPO 4.6). */
export function ProgressBar({
  value,
  className,
  fillClassName = 'bg-primary',
  label,
}: {
  value: number;
  className?: string;
  fillClassName?: string;
  label: string;
}) {
  const ratio = Math.max(0, Math.min(1, value));
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.set(withTiming(ratio, { duration: 400 }));
  }, [progress, ratio]);
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
    >
      {/* A cor fica num View comum: o Animated.View não recebe as classes do NativeWind */}
      <Animated.View style={[{ height: '100%' }, style]}>
        <View className={cn('h-full rounded-full', fillClassName)} />
      </Animated.View>
    </View>
  );
}

function LevelLine({ game }: { game: GameState }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-sm font-bold text-foreground">Nv {game.level}</Text>
      <ProgressBar
        className="flex-1"
        value={game.into_level / game.for_next}
        label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
      />
      <Text className="text-xs text-muted-foreground">
        {game.into_level}/{game.for_next} XP
      </Text>
      <Text
        className={cn('text-sm', game.active_today ? 'text-foreground' : 'text-muted-foreground')}
        accessibilityLabel={`Dias seguidos: ${game.streak}`}
      >
        🔥 {game.streak}
      </Text>
    </View>
  );
}

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

const DEFEATED_TAIL = {
  user: 'O próximo chega na segunda.',
  clan: 'O clã inteiro ganhou a recompensa. O próximo chega na segunda.',
  folder: 'Projeto concluído antes do prazo! 🎉',
} as const;

/** Barra do boss: solo e clã (semanais) ou de projeto (com prazo). */
export function BossLine({ boss, prefix }: { boss: Boss; prefix?: string }) {
  const scope = boss.scope ?? 'user';
  if (boss.status === 'defeated') {
    return (
      <Text className="text-sm text-foreground">
        ⚔️ {prefix}
        {boss.icon} {boss.name} derrotado! {DEFEATED_TAIL[scope]}
      </Text>
    );
  }
  // ends_at é o fim do último dia (00:00 do dia seguinte)
  const lastDay = new Date(new Date(boss.ends_at).getTime() - 1);
  const until = scope === 'folder' ? DAY_MONTH.format(lastDay) : WEEKDAY.format(lastDay);
  const escaped = boss.status === 'escaped';
  const unit = scope === 'folder' ? 'tarefas' : 'HP';
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
          {prefix}
          {boss.icon} {boss.name}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {scope === 'folder'
            ? `faltam ${boss.hp} de ${boss.max_hp} ${unit}`
            : `${boss.hp}/${boss.max_hp} HP`}
          {escaped ? ' · fugiu' : ` · até ${until}`}
        </Text>
      </View>
      <ProgressBar
        value={boss.hp / boss.max_hp}
        fillClassName="bg-destructive"
        label={`Boss ${boss.name}: ${boss.hp} de ${boss.max_hp} ${unit}`}
      />
    </View>
  );
}

/** Topo da tela Hoje: nível, XP, sequência e o boss da semana. Some com a gamificação desligada. */
export function GameHeader() {
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Nível, XP e boss da semana"
        className="mb-2 gap-2 rounded-xl border border-border bg-card px-3 py-2 active:opacity-80"
      >
        <LevelLine game={game} />
        {game.boss && <BossLine boss={game.boss} />}
        {game.clan_boss && <BossLine boss={game.clan_boss} prefix="Clã: " />}
      </Pressable>
    </Link>
  );
}

/** Rodapé da barra lateral: só nível e sequência. */
export function SidebarGame() {
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Nível ${game.level}, dias seguidos: ${game.streak}`}
        className="mx-3 mb-3 rounded-lg border border-border bg-background px-3 py-2 active:bg-muted"
      >
        <LevelLine game={game} />
      </Pressable>
    </Link>
  );
}
