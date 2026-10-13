import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar, classOf } from '@/components/character';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import { CLASSES } from '@/lib/character';
import { cn } from '@/lib/cn';
import { useGameState, type Boss, type GameState } from '@/lib/queries/game';

export { ProgressBar };

function LevelLine({ game }: { game: GameState }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-sm font-semibold text-ink">Nv {game.level}</Text>
      <ProgressBar
        className="flex-1"
        value={game.into_level / game.for_next}
        label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
      />
      <Text className="text-xs text-ink-muted">
        {game.into_level}/{game.for_next} XP
      </Text>
      <Text
        className={cn('text-sm', game.active_today ? 'text-ink' : 'text-ink-muted')}
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
      <Text className="text-sm text-ink">
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
        <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
          {prefix}
          {boss.icon} {boss.name}
          {scope !== 'folder' && boss.level ? (
            <Text className="text-xs text-ink-muted"> · nv {boss.level}</Text>
          ) : null}
        </Text>
        <Text className="text-xs text-ink-muted">
          {scope === 'folder'
            ? `faltam ${boss.hp} de ${boss.max_hp} ${unit}`
            : `${boss.hp}/${boss.max_hp} HP`}
          {escaped ? ' · fugiu' : ` · até ${until}`}
        </Text>
      </View>
      <ProgressBar
        value={boss.hp / boss.max_hp}
        fillClassName="bg-danger"
        label={`Boss ${boss.name}: ${boss.hp} de ${boss.max_hp} ${unit}`}
      />
    </View>
  );
}

/** Topo da tela Hoje (celular e tela estreita): personagem, nível, ouro e os bosses. */
export function GameHeader() {
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  const cls = classOf(game);
  return (
    <Link href="/character" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Personagem, nível, XP e boss da semana"
        className="mb-2 gap-2 rounded-lg border border-line bg-surface px-3 py-2 active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          <Avatar game={game} size="sm" />
          <View className="flex-1 gap-1">
            <LevelLine game={game} />
            <Text className="text-xs text-ink-muted" numberOfLines={1}>
              {cls ? `${CLASSES[cls].icon} ${CLASSES[cls].name}` : '🧭 Escolha sua classe →'} · 🪙{' '}
              {game.gold}
              {(game.points ?? 0) > 0 ? ` · ✨ ${game.points} ponto(s)` : ''}
              {game.skill_active ? ' · ⚡ habilidade ativa' : ''}
            </Text>
          </View>
        </View>
        {game.boss && <BossLine boss={game.boss} />}
        {game.clan_boss && <BossLine boss={game.clan_boss} prefix="Clã: " />}
      </Pressable>
    </Link>
  );
}

/** Rodapé da barra lateral: personagem, nível, sequência e ouro. */
export function SidebarGame() {
  const { data: game } = useGameState();
  if (!game?.enabled) return null;
  return (
    <Link href="/character" asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Personagem: nível ${game.level}, dias seguidos: ${game.streak}, ${game.gold} de ouro`}
        className="mx-3 mb-3 flex-row items-center gap-3 rounded-lg border border-line bg-paper p-2 active:bg-wash"
      >
        <Avatar game={game} size="sm" />
        <View className="flex-1 gap-1">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm font-semibold text-ink">Nível {game.level}</Text>
            <Text className="text-xs text-ink-muted">
              🔥 {game.streak} · 🪙 {game.gold}
            </Text>
          </View>
          <ProgressBar
            value={game.into_level / game.for_next}
            label={`Nível ${game.level}: ${game.into_level} de ${game.for_next} XP`}
          />
          <Text className="text-xs text-ink-muted">
            {game.into_level}/{game.for_next} XP
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
