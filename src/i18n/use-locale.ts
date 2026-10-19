import { useEffect, useState } from 'react';

import { getLocalePreference } from '@/lib/prefs';
import { updatePushLocale } from '@/lib/push';
import { useProfile, useUpdateProfile } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';

import i18n, { setLocale } from '.';
import { isLocale, type LocalePreference } from './locale';

/**
 * Aplica o idioma salvo no perfil (escolhido em outro aparelho). Perfil sem idioma (nulo) não
 * mexe na escolha deste aparelho.
 */
export function useLocaleSync() {
  const locale = useProfile().data?.locale;
  useEffect(() => {
    if (isLocale(locale) && locale !== getLocalePreference()) setLocale(locale);
  }, [locale]);
}

/** Escolha de idioma: muda na hora neste aparelho e salva no perfil quando há conexão. */
export function useLocalePreference() {
  const [preference, setPreference] = useState(getLocalePreference);
  const update = useUpdateProfile();
  const online = useIsOnline();

  // O idioma pode mudar por fora (useLocaleSync, escolhido em outro aparelho): o seletor acompanha
  useEffect(() => {
    const onChange = () => setPreference(getLocalePreference());
    i18n.on('languageChanged', onChange);
    return () => i18n.off('languageChanged', onChange);
  }, []);

  function choose(value: LocalePreference) {
    setPreference(value);
    setLocale(value);
    if (online) {
      update.mutate({ locale: value === 'system' ? null : value });
      // O push deste aparelho passa a sair no idioma novo (F3)
      updatePushLocale(i18n.language).catch(() => {});
    }
  }

  return { preference, choose };
}
