import { colorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/prefs';

const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}>({ preference: 'system', setPreference: () => {} });

/** Na web o NativeWind não resolve "Sistema" sozinho (D21): olhamos o prefers-color-scheme. */
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
    <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemeContext);
}
