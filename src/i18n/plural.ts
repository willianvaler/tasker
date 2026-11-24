import type { i18n as I18n } from 'i18next';

/**
 * O CLDR põe o 0 no singular em português ("0 tarefa concluída"); na fala do Brasil é plural
 * ("0 tarefas"). Troca só o 0 do cardinal em português; as chaves `_zero`, quando existem,
 * continuam vencendo (o i18next as procura antes).
 */
export function pluralZeroAsOther(instance: I18n) {
  const resolver = instance.services.pluralResolver;
  const baseRule = resolver.getRule.bind(resolver);
  resolver.getRule = (code: string, options: { ordinal?: boolean } = {}) => {
    const rule = baseRule(code, options);
    if (!rule || options.ordinal || !code.startsWith('pt')) return rule;
    return {
      select: (count: number) => (count === 0 ? 'other' : rule.select(count)),
      resolvedOptions: () => rule.resolvedOptions(),
    } as Intl.PluralRules;
  };
}
