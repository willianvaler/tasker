import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getLocalePreference, setLocalePreference } from '@/lib/prefs';

import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import { DEFAULT_LOCALE, type Locale, type LocalePreference, resolveLocale } from './locale';

export const resources = {
  'pt-BR': { translation: ptBR },
  en: { translation: en },
  es: { translation: es },
} as const;

/** Idioma do aparelho, entre os suportados. */
export function deviceLocale(): Locale {
  return resolveLocale(getLocales().map((l) => l.languageTag));
}

function localeFor(preference: LocalePreference): Locale {
  return preference === 'system' ? deviceLocale() : preference;
}

const i18n = createInstance();

// Recursos embutidos: a inicialização é síncrona, a primeira tela já sai traduzida.
// O initReactI18next registra esta instância para o useTranslation().
i18n.use(initReactI18next).init({
  resources,
  lng: localeFor(getLocalePreference()),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false }, // o React já escapa
  returnNull: false,
  initAsync: false,
});

/** Troca o idioma e guarda a escolha no aparelho. */
export function setLocale(preference: LocalePreference) {
  setLocalePreference(preference);
  return i18n.changeLanguage(localeFor(preference));
}

export default i18n;
