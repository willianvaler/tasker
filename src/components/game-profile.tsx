import { Switch, Text, View } from 'react-native';

import { BossLine, ProgressBar } from '@/components/game-bar';
import { cn } from '@/lib/cn';
import { useGameState, useSetGamification } from '@/lib/queries/game';
import { useIsOnline } from '@/providers/online';

/** Perfil: estatísticas, conquistas e o liga/desliga da gamificação (ESCOPO 4.6). */
export function GameProfile() {
  const { data: game } = useGameState();
  const setEnabled = useSetGamification();
  const online = useIsOnline();
  if (!game) return null;

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">Gamificação</Text>
          <Text className="text-sm text-muted-foreground">
            XP, nível, sequência e boss. Desligada, some da tela (o histórico continua guardado).
          </Text>
        </View>
        <Switch
          accessibilityLabel="Gamificação"
          aria-checked={game.enabled}
          value={game.enabled}
          disabled={!online}
          onValueChange={(value) => setEnabled.mutate(value)}
        />
      </View>

      {game.enabled && (
        <>
          <View className="gap-2 rounded-xl border border-border bg-card p-3">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-xl font-bold text-foreground">Nível {game.level}</Text>
              <Text className="text-sm text-muted-foreground">{game.xp} XP no total</Text>
            </View>
            <ProgressBar
              value={game.into_level / game.for_next}
              label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
            />
            <Text className="text-xs text-muted-foreground">
              Faltam {game.for_next - game.into_level} XP para o nível {game.level + 1}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <Stat label="Dias seguidos" value={`🔥 ${game.streak}`} />
            <Stat label="Recorde" value={`${game.streak_best}`} />
            <Stat label="Concluídas" value={`${game.tasks_done}`} />
            <Stat label="XP hoje" value={`${game.xp_today}`} />
          </View>
          <Text className="text-xs text-muted-foreground">
            {game.freeze_available
              ? '🧊 Congelamento da semana disponível: um dia sem tarefas não quebra a sequência.'
              : '🧊 O congelamento desta semana já foi usado.'}
          </Text>

          {game.boss && (
            <View className="gap-1 rounded-xl border border-border bg-card p-3">
              <Text className="text-sm font-semibold text-foreground">Boss da semana</Text>
              <BossLine boss={game.boss} />
              <Text className="text-xs text-muted-foreground">
                Cada XP ganho é um ponto de dano. Se ele fugir, o próximo vem sem punição.
              </Text>
            </View>
          )}

          <View className="gap-2">
            <Text className="font-semibold text-foreground">Conquistas</Text>
            <View className="flex-row flex-wrap gap-2">
              {game.achievements.map((a) => (
                <View
                  key={a.key}
                  accessibilityLabel={`${a.name}: ${a.description}${a.unlocked_at ? '' : ' (bloqueada)'}`}
                  className={cn(
                    'w-[31%] min-w-28 flex-grow items-center gap-1 rounded-xl border border-border p-2',
                    a.unlocked_at ? 'bg-card' : 'opacity-40',
                  )}
                >
                  <Text style={{ fontSize: 24, lineHeight: 30 }}>
                    {a.unlocked_at ? a.icon : '🔒'}
                  </Text>
                  <Text className="text-center text-sm font-medium text-foreground">{a.name}</Text>
                  <Text className="text-center text-xs text-muted-foreground">{a.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-xl border border-border bg-card py-2">
      <Text className="text-lg font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
