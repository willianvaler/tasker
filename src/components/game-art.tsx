import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { BOSS_ART_BY_NAME, GAME_ART } from '@/lib/game-art';

type Group = keyof typeof GAME_ART;

/** Arte pintada do jogo (assets/game, ESCOPO_V8 §4). Sem a imagem, mostra o emoji de reserva. */
export function ArtImage({
  group,
  id,
  size,
  fallback,
  label,
  className,
  wide,
}: {
  group: Group;
  id: string | null | undefined;
  size: number;
  fallback?: string;
  label?: string;
  className?: string;
  /** Cenário: 16:9 em vez de quadrado */
  wide?: boolean;
}) {
  const source = id ? (GAME_ART[group] as Record<string, number>)[id] : undefined;
  const height = wide ? Math.round((size * 9) / 16) : size;
  if (!source)
    return (
      <View
        accessibilityRole={label ? 'image' : undefined}
        accessibilityLabel={label}
        className={cn('items-center justify-center rounded bg-wash', className)}
        style={{ width: size, height }}
      >
        <Text style={{ fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.6) }}>
          {fallback ?? '❔'}
        </Text>
      </View>
    );
  return (
    <Image
      source={source}
      accessibilityLabel={label}
      accessible={!!label}
      contentFit="cover"
      transition={150}
      style={{ width: size, height, borderRadius: 6 }}
      className={className}
    />
  );
}

/** Chave da arte de um boss: a missão pelo quest_key; os outros pelo nome. */
export function bossArtId(boss: { name: string; quest_key?: string | null }) {
  return boss.quest_key ?? BOSS_ART_BY_NAME[boss.name] ?? null;
}
