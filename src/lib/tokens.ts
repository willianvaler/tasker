import { useColorScheme } from 'nativewind';

// Tokens do design "Caderno de bolso". As cores valem também como variáveis em
// src/global.css (o teste design-tokens compara); aqui ficam para o que não aceita classe: tema da
// navegação, placeholder, traço de SVG.

export const COLORS = {
  light: {
    paper: '#F6F2EA',
    surface: '#FBF8F2',
    wash: '#EDE7DB',
    ink: '#1F1D1A',
    'ink-muted': '#6B655B',
    line: '#E2DBCD',
    accent: '#A94604',
    'accent-soft': '#FBE3D2',
    'on-accent': '#FBF8F2',
    ok: '#3A7448',
    warn: '#89600C',
    danger: '#B3261E',
    scrim: '#1B1A17',
    'rarity-common': '#6B655B',
    'rarity-uncommon': '#3A7448',
    'rarity-rare': '#2E5E8C',
    'rarity-epic': '#6F4A93',
    'rarity-legendary': '#8A5F00',
  },
  dark: {
    paper: '#1B1A17',
    surface: '#23211D',
    wash: '#2C2A25',
    ink: '#ECE6DA',
    'ink-muted': '#9B9487',
    line: '#34312B',
    accent: '#FF8A3D',
    'accent-soft': '#3D2A1C',
    'on-accent': '#1B1A17',
    ok: '#6DB27D',
    warn: '#E0A93A',
    danger: '#F2766B',
    scrim: '#0E0D0B',
    'rarity-common': '#9B9487',
    'rarity-uncommon': '#6DB27D',
    'rarity-rare': '#7FB0E3',
    'rarity-epic': '#BC9CE6',
    'rarity-legendary': '#E2B54C',
  },
} as const;

export type ColorToken = keyof (typeof COLORS)['light'];

/** Cores do tema que está na tela agora. */
export function useColors() {
  const { colorScheme } = useColorScheme();
  return COLORS[colorScheme === 'dark' ? 'dark' : 'light'];
}

/** Cores da marca (logo, ícone, lojas; ESCOPO_V8 §0). Só no símbolo: o app usa as do tema. */
export const BRAND = { green: '#0F3D32', orange: '#FF8A3D', cream: '#F8F7F4' } as const;

/** Paleta curada para o marcador de pasta/projeto (tons de pigmento, nunca em fundo grande). */
export const MARKER_COLORS = [
  '#A35D4A',
  '#B07A4F',
  '#8A7A4F',
  '#7A8B5C',
  '#4F7A6A',
  '#5F7A8A',
  '#5C5F8A',
  '#7A5C7A',
  '#6B655B',
  '#9B8F7A',
] as const;

/** Durações de animação (ms): curtas e úteis. */
export const DURATION = { fast: 100, base: 150, slow: 180 } as const;

/** Medidas fixas (px). */
export const SIZE = {
  rowDesktop: 40,
  rowMobile: 52,
  button: 32,
  touch: 44,
  icon: 16,
  iconNav: 20,
  sidebar: 256,
  /** Painel lateral (Sheet): cresce com a janela entre panel e panelMax (W5: 400 ficava espremido) */
  panel: 480,
  panelMax: 680,
  reading: 760,
  /** Barra do timer flutuante (telas sem a barra de baixo): distância do fundo */
  timerBar: 16,
  /** Espaço no fim de uma rolagem para a barra do timer não cobrir o último item */
  timerBarClear: 72 + 44 + 24,
} as const;

/** "#D8452B" → "216 69 43" (formato das variáveis do global.css). */
export function hexToRgbTriplet(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
