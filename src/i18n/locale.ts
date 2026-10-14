// Idiomas do app. pt-BR é o padrão e a referência das chaves.
export const LOCALES = ['pt-BR', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt-BR';

/** Escolha do usuário: um idioma fixo ou o do aparelho. */
export type LocalePreference = Locale | 'system';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Primeiro idioma suportado da lista do aparelho (tags BCP 47, em ordem de preferência).
 * Qualquer português vira pt-BR; inglês e espanhol de qualquer região viram en / es.
 */
export function resolveLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    const language = tag?.split(/[-_]/)[0]?.toLowerCase();
    if (language === 'pt') return 'pt-BR';
    if (language === 'en') return 'en';
    if (language === 'es') return 'es';
  }
  return DEFAULT_LOCALE;
}
