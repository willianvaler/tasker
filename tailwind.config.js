/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class': o tema escuro vem da classe "dark" (as variáveis em .dark:root do global.css). No
  // celular o NativeWind a aplica pelo Appearance; na web, providers/theme.tsx (D55).
  darkMode: 'class',
  theme: {
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
