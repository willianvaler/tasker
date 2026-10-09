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
        // Cores do app em variáveis CSS (definidas em src/global.css), para o tema claro/escuro
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        destructive: 'rgb(var(--destructive) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
