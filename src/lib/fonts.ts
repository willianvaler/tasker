import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans/400Regular';
import { InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans/600SemiBold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';

// Fontes embutidas no app (sem CDN). Os nomes são as famílias usadas no
// tailwind.config.js (fontFamily) e no components/ui/text.tsx. Só os pesos usados, um arquivo cada.
export const FONTS = {
  Fraunces_500Medium,
  InstrumentSans_400Regular,
  InstrumentSans_600SemiBold,
  JetBrainsMono_400Regular,
};

/** Para estilos que não aceitam classe (rótulo das abas, tema da navegação). */
export const FONT_FAMILY = {
  sans: 'InstrumentSans_400Regular',
  sansSemibold: 'InstrumentSans_600SemiBold',
  serif: 'Fraunces_500Medium',
  mono: 'JetBrainsMono_400Regular',
} as const;
