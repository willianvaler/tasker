/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' só para o NativeWind não lançar erro no dev da web (ele observa a classe do <html> e,
  // em 'media', recusa o ajuste). As cores continuam seguindo o sistema pelo @media do global.css,
  // e o app não usa variantes dark: (D21).
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
