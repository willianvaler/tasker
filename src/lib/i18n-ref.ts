import ptBR from '@/i18n/locales/pt-BR.json';

// Tradução para módulos puros (lib/), sem importar o i18n (que puxa armazenamento do aparelho e
// quebra os testes). O src/i18n registra a função de verdade ao iniciar; antes disso (e nos
// testes), vale o português.

type Vars = Record<string, unknown>;
type Translate = (key: string, vars?: Vars) => string;

function fallback(key: string, vars?: Vars): string {
  let node: unknown = ptBR;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  const template = typeof node === 'string' ? node : key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars?.[name] ?? ''));
}

let current: Translate = fallback;
export function setTranslate(fn: Translate) {
  current = fn;
}
export const tr: Translate = (key, vars) => current(key, vars);
