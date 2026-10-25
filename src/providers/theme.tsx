import { colorScheme, useColorScheme, vars } from 'nativewind';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { useDarkPalette } from '@/lib/dark-palette';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/prefs';
import { DARK_PALETTE_IDS, darkPaletteVars } from '@/lib/tokens';

/** Todas as variáveis que algum fundo escuro troca (para limpar ao voltar ao claro ou ao marrom). */
const PALETTE_VARS = [
  ...new Set(DARK_PALETTE_IDS.flatMap((id) => Object.keys(darkPaletteVars(id)))),
];

const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>({ preference: 'system', setPreference: () => {} });

/** Na web o NativeWind não resolve "Sistema" sozinho: olhamos o prefers-color-scheme. */
function applyTheme(preference: ThemePreference) {
  if (Platform.OS !== 'web') {
    colorScheme.set(preference);
    return;
  }
  const systemDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  colorScheme.set(preference === 'system' ? (systemDark ? 'dark' : 'light') : preference);
}

/** Tema escolhido no aparelho (Sistema, Claro, Escuro), guardado nas preferências locais. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(getThemePreference);

  useEffect(() => {
    applyTheme(preference);
    if (Platform.OS !== 'web' || preference !== 'system') return;
    // Sistema na web: acompanha quando o computador troca de claro para escuro
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media?.addEventListener('change', onChange);
    return () => media?.removeEventListener('change', onChange);
  }, [preference]);

  function setPreference(next: ThemePreference) {
    setThemePreference(next);
    setPreferenceState(next);
  }

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      <DarkPalette>{children}</DarkPalette>
    </ThemeContext.Provider>
  );
}

/**
 * Fundo escolhido para o escuro (CD29): por cima das variáveis do `.dark:root`. Na web vão no
 * <html> (o estilo da própria tag vence a regra do global.css, e o fundo atrás das telas muda
 * junto); no celular, pelo vars() do NativeWind numa View que envolve o app.
 */
function DarkPalette({ children }: { children: ReactNode }) {
  const palette = useDarkPalette();
  const dark = useColorScheme().colorScheme === 'dark';
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = globalThis.document?.documentElement;
    if (!root) return;
    for (const name of PALETTE_VARS) root.style.removeProperty(name);
    if (dark) {
      for (const [name, value] of Object.entries(darkPaletteVars(palette)))
        root.style.setProperty(name, value);
    }
  }, [dark, palette]);
  if (Platform.OS === 'web') return children;
  return (
    <View
      style={[{ flex: 1 }, dark && palette !== 'brown' ? vars(darkPaletteVars(palette)) : null]}
    >
      {children}
    </View>
  );
}

export function useThemePreference() {
  return useContext(ThemeContext);
}
