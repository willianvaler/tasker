import { Text as RNText, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * Texto do app. No React Native cada peso de fonte é uma família própria (com fontWeight o Android
 * ignora a fonte e o navegador "engorda" a regular), então a família sai das classes:
 * `font-serif` (Fraunces 500, títulos), `font-mono` (JetBrains Mono, números e atalhos) ou a
 * Instrument Sans, regular ou `font-semibold`. Nunca importe o Text direto do react-native.
 */
export function Text({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={textClass(className)} {...props} />;
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
