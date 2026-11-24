import { Platform, Text as RNText, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * No RN cada peso é uma família (com fontWeight o Android ignora a fonte e o navegador engorda a
 * regular), então a família sai das classes font-serif / font-mono / font-semibold.
 */
export function Text({ className, style, children, ...props }: TextProps & { className?: string }) {
  const upper = isUppercaseSans(className);
  return (
    <RNText
      className={textClass(className)}
      style={upper && Platform.OS === 'web' ? [style, WEB_WORD_SPACING] : style}
      {...props}
    >
      {upper && Platform.OS !== 'web' && typeof children === 'string'
        ? widenSpaces(children)
        : children}
    </RNText>
  );
}

const WEIGHT = /(^|\s)font-(normal|semibold)(?=\s|$)/g;

export function textClass(className = '') {
  const family = /(^|\s)font-serif(\s|$)/.test(className)
    ? 'font-serif'
    : /(^|\s)font-mono(\s|$)/.test(className)
      ? 'font-mono'
      : /(^|\s)font-semibold(\s|$)/.test(className)
        ? 'font-sans-semibold'
        : 'font-sans';
  return cn(family, className.replace(WEIGHT, ' ').replace(/\s+/g, ' ').trim());
}

/**
 * O espaço da Instrument Sans é estreito (0,19 em): em caixa-alta, 12 px, "SEU NICK" virava
 * "SEUNICK". Na web, `word-spacing`; no celular (o RN não tem), um espaço fixo a mais por palavra.
 * O mono tem largura fixa e não precisa.
 */
export function isUppercaseSans(className = '') {
  return /(^|\s)uppercase(\s|$)/.test(className) && !/(^|\s)font-mono(\s|$)/.test(className);
}

export function widenSpaces(text: string) {
  return text.replace(/ /g, '  ');
}

// wordSpacing não está nos tipos do RN; o react-native-web repassa para o CSS
const WEB_WORD_SPACING = { wordSpacing: '0.12em' } as object;
