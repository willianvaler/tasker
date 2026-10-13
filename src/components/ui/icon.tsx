import type { LucideIcon } from 'lucide-react-native';

import { useColors, type ColorToken } from '@/lib/tokens';

/**
 * Ícone do conjunto único (Lucide, traço de 1,5 px; docs/DESIGN.md). 16 px dentro do texto, 20 px
 * na navegação e em botões. A cor vem de um token do tema, nunca de um valor solto.
 */
export function Icon({
  icon: Glyph,
  size = 16,
  tone = 'ink',
  label,
}: {
  icon: LucideIcon;
  size?: 16 | 20 | 24;
  tone?: ColorToken;
  /** Só quando o ícone é a única informação (sem texto do lado) */
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
