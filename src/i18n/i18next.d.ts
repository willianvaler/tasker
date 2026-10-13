import 'i18next';

import type ptBR from './locales/pt-BR.json';

// Chaves tipadas a partir do pt-BR: t('chave.que.nao.existe') não compila.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ptBR };
  }
}
