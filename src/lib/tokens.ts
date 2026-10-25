import { useColorScheme } from 'nativewind';

import { useDarkPalette } from './dark-palette';

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
export type Palette = Record<ColorToken, string>;

/**
 * Fundos do modo escuro (CD29): o marrom é o de sempre (COLORS.dark, também no global.css); os
 * outros trocam só os fundos, as linhas e os tons apagados, com a luminância perto da do marrom
 * para o texto, o acento e as cores de estado manterem o AA (o teste design-tokens confere todos).
 */
export const DARK_PALETTES = {
  brown: {},
  green: {
    paper: '#141C18',
    surface: '#1A241F',
    wash: '#222E27',
    line: '#2D3B33',
    'ink-muted': '#95A399',
    'accent-soft': '#3A2C1D',
    'on-accent': '#141C18',
    scrim: '#0A0F0C',
    'rarity-common': '#95A399',
  },
  blue: {
    paper: '#141821',
    surface: '#1A1F2A',
    wash: '#222834',
    line: '#2D3441',
    'ink-muted': '#979EAD',
    'accent-soft': '#3A2B22',
    'on-accent': '#141821',
    scrim: '#0A0C11',
    'rarity-common': '#979EAD',
  },
  graphite: {
    paper: '#18181A',
    surface: '#1F1F22',
    wash: '#28282C',
    line: '#333338',
    'ink-muted': '#9C9CA3',
    'accent-soft': '#3B2A1E',
    'on-accent': '#18181A',
    scrim: '#0C0C0D',
    'rarity-common': '#9C9CA3',
  },
  black: {
    paper: '#000000',
    surface: '#0D0D0D',
    wash: '#1A1A1A',
    line: '#262626',
    'ink-muted': '#9E9E9E',
    'accent-soft': '#33220F',
    'on-accent': '#000000',
    scrim: '#000000',
    'rarity-common': '#9E9E9E',
  },
  plum: {
    paper: '#1A1620',
    surface: '#211C28',
    wash: '#2A2432',
    line: '#362E3F',
    'ink-muted': '#A398AE',
    'accent-soft': '#3C2A22',
    'on-accent': '#1A1620',
    scrim: '#0D0B10',
    'rarity-common': '#A398AE',
  },
} as const satisfies Record<string, Partial<Palette>>;

export type DarkPalette = keyof typeof DARK_PALETTES;
export const DARK_PALETTE_IDS = Object.keys(DARK_PALETTES) as DarkPalette[];

/** As cores do escuro com o fundo escolhido. */
export function darkColors(palette: DarkPalette): Palette {
  return { ...COLORS.dark, ...DARK_PALETTES[palette] };
}

/** Variáveis do global.css que o fundo escolhido troca ({"--paper": "20 28 24"}). */
export function darkPaletteVars(palette: DarkPalette): Record<string, string> {
  return Object.fromEntries(
    Object.entries(DARK_PALETTES[palette]).map(([k, hex]) => [`--${k}`, hexToRgbTriplet(hex)]),
  );
}

/** Cores do tema que está na tela agora. */
export function useColors(): Palette {
  const { colorScheme } = useColorScheme();
  const palette = useDarkPalette();
  return colorScheme === 'dark' ? darkColors(palette) : COLORS.light;
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
