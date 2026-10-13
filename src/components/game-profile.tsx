import { Switch, View } from 'react-native';

import { BossLine, ProgressBar } from '@/components/game-bar';
import { Text } from '@/components/ui/text';
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
          <Text className="font-semibold text-ink">Gamificação</Text>
          <Text className="text-sm text-ink-muted">
            XP, nível, personagem, boss e loja. Desligada, some da tela (o histórico continua
            guardado).
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
          <View className="gap-2 rounded-lg border border-line bg-surface p-3">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-lg font-semibold text-ink">Nível {game.level}</Text>
              <Text className="text-sm text-ink-muted">{game.xp} XP no total</Text>
            </View>
            <ProgressBar
              value={game.into_level / game.for_next}
              label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
            />
            <Text className="text-xs text-ink-muted">
              Faltam {game.for_next - game.into_level} XP para o nível {game.level + 1}
            </Text>
          </View>

          <View className="flex-row gap-2">
            <Stat label="Dias seguidos" value={`🔥 ${game.streak}`} />
            <Stat label="Recorde" value={`${game.streak_best}`} />
            <Stat label="Concluídas" value={`${game.tasks_done}`} />
            <Stat label="XP hoje" value={`${game.xp_today}`} />
            <Stat label="Ouro" value={`🪙 ${game.gold}`} />
          </View>
          <Text className="text-xs text-ink-muted">
            {game.freeze_available
              ? '🧊 Congelamento da semana disponível: um dia sem tarefas não quebra a sequência.'
              : '🧊 O congelamento desta semana já foi usado.'}
          </Text>

          {game.boss && (
            <View className="gap-1 rounded-lg border border-line bg-surface p-3">
              <Text className="text-sm font-semibold text-ink">Boss da semana</Text>
              <BossLine boss={game.boss} />
              <Text className="text-xs text-ink-muted">
                Cada tarefa, hábito e card é um golpe; atributos e classe mudam o dano (veja em
                Personagem). Vencer sobe o nível do próximo. Se ele fugir, o próximo vem sem
                punição.
              </Text>
            </View>
          )}

          <View className="gap-2">
            <Text className="font-semibold text-ink">
              Conquistas ({game.achievements.filter((a) => a.unlocked_at).length}/
              {game.achievements.length})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {game.achievements.map((a) => (
                <View
                  key={a.key}
                  accessibilityLabel={`${a.name}: ${a.description}${a.unlocked_at ? '' : ' (bloqueada)'}`}
                  className={cn(
                    'w-[31%] min-w-28 flex-grow items-center gap-1 rounded-lg border border-line p-2 md:w-[23%] xl:w-[18%]',
                    a.unlocked_at ? 'bg-surface' : 'opacity-40',
                  )}
                >
                  <Text style={{ fontSize: 24, lineHeight: 30 }}>
                    {a.unlocked_at ? a.icon : '🔒'}
                  </Text>
                  <Text className="text-center text-sm font-normal text-ink">{a.name}</Text>
                  <Text className="text-center text-xs text-ink-muted">{a.description}</Text>
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
    <View className="flex-1 items-center rounded-lg border border-line bg-surface py-2">
      <Text className="text-lg font-semibold text-ink">{value}</Text>
      <Text className="text-xs text-ink-muted">{label}</Text>
    </View>
  );
}
