import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { setCurrentLocale, setTranslate } from '@/lib/i18n-ref';
import { setDateLocale } from '@/lib/parser/dates';
import { getLocalePreference, setLocalePreference } from '@/lib/prefs';

import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import vocabEn from './vocab/en.json';
import vocabEs from './vocab/es.json';
import vocabPtBR from './vocab/pt-BR.json';
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

// Datas da interface ("Hoje", "sex, 17 out") e o parser seguem o idioma
setDateLocale(i18n.language);
setTranslate((key, vars) => i18n.t(key as 'common.someone', vars) as string);
setCurrentLocale(i18n.language);
i18n.on('languageChanged', (locale: string) => {
  setDateLocale(locale);
  setCurrentLocale(locale);
});

/** Troca o idioma e guarda a escolha no aparelho. */
export function setLocale(preference: LocalePreference) {
  setLocalePreference(preference);
  return i18n.changeLanguage(localeFor(preference));
}

export default i18n;

/** Vocabulário de jogo (HB11): textos que o modo Completo troca ("tarefa" → "missão"). */
export const GAME_VOCAB: Record<Locale, Record<string, string>> = {
  'pt-BR': vocabPtBR,
  en: vocabEn,
  es: vocabEs,
};

function original(locale: Locale, key: string): string {
  let node: unknown = resources[locale].translation;
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  return node as string;
}

let vocabOn = false;

/** Liga ou desliga o vocabulário de jogo em todos os idiomas e redesenha as telas. */
export function setGameVocab(on: boolean) {
  if (on === vocabOn) return;
  vocabOn = on;
  for (const locale of Object.keys(GAME_VOCAB) as Locale[])
    for (const [key, value] of Object.entries(GAME_VOCAB[locale]))
      i18n.addResource(locale, 'translation', key, on ? value : original(locale, key));
  // O useTranslation() redesenha quando o idioma "muda"
  void i18n.changeLanguage(i18n.language);
}
