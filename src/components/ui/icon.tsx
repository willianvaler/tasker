import type { LucideIcon } from 'lucide-react-native';

import { useColors, type ColorToken } from '@/lib/tokens';

export function Icon({
  icon: Glyph,
  size = 16,
  tone = 'ink',
  label,
}: {
  icon: LucideIcon;
  size?: 16 | 20 | 24;
  tone?: ColorToken;
  label?: string;
}) {
  const colors = useColors();
  return (
    <Glyph
      size={size}
      color={colors[tone]}
      strokeWidth={1.5}
      absoluteStrokeWidth
      // Só atributos com valor: o SVG da web recusa `false` em atributo que não é booleano
      {...(label ? { accessibilityLabel: label, role: 'img' as const } : { 'aria-hidden': true })}
    />
  );
}
