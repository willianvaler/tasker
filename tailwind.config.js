const SPACE = {
  0: '0px',
  px: '1px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  12: '48px',
  clear: '112px',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class': o tema escuro vem da classe "dark" (as variáveis em .dark:root do global.css). No
  // celular o NativeWind a aplica pelo Appearance; na web, providers/theme.tsx (D55).
  darkMode: 'class',
  theme: {
    // Escalas fechadas do docs/DESIGN.md (V3 §0.3). Classes fora delas não existem.
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      lg: ['20px', '28px'],
      xl: ['28px', '34px'],
    },
    // Só 400 e 600; a família de cada peso é escolhida pelo components/ui/text.tsx
    fontWeight: { normal: '400', semibold: '600' },
    fontFamily: {
      sans: ['InstrumentSans_400Regular'],
      'sans-semibold': ['InstrumentSans_600SemiBold'],
      serif: ['Fraunces_500Medium'],
      mono: ['JetBrainsMono_400Regular'],
    },
    borderRadius: { none: '0px', DEFAULT: '4px', lg: '8px', full: '9999px' },
    // Espaço: 4 · 8 · 12 · 16 · 24 · 32 · 48 (+ "clear", folga para os controles flutuantes)
    padding: SPACE,
    margin: { ...SPACE, auto: 'auto' },
    gap: SPACE,
    space: SPACE,
    extend: {
      colors: {
        // Tokens do docs/DESIGN.md (variáveis em src/global.css)
        'paper': 'rgb(var(--paper) / <alpha-value>)',
        'surface': 'rgb(var(--surface) / <alpha-value>)',
        'wash': 'rgb(var(--wash) / <alpha-value>)',
        'ink': 'rgb(var(--ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted) / <alpha-value>)',
        'line': 'rgb(var(--line) / <alpha-value>)',
        'accent': 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        'ok': 'rgb(var(--ok) / <alpha-value>)',
        'warn': 'rgb(var(--warn) / <alpha-value>)',
        'danger': 'rgb(var(--danger) / <alpha-value>)',
        'scrim': 'rgb(var(--scrim) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
