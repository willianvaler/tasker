import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { SlashId, SlashItem } from '@/lib/block-editor/slash';
import { CALLOUT_ALIASES } from '@/lib/note-blocks';

// Os componentes do menu `/` do editor de blocos (R1.2, D371), com os textos do i18n (web e celular).
const IDS: SlashId[] = [
  'text',
  'h1',
  'h2',
  'h3',
  'bullet',
  'ordered',
  'task',
  'quote',
  'callout',
  'code',
  'table',
  'divider',
  'formula',
  'query',
  'button',
  'link',
  'embed',
  'image',
  'today',
];

export function useSlashItems(): SlashItem[] {
  const { t } = useTranslation();
  return IDS.map((id) => ({
    id,
    label: t(`blockEditor.items.${id}.label`),
    hint: t(`blockEditor.items.${id}.hint`),
    keywords: t(`blockEditor.items.${id}.keywords`),
  }));
}

/**
 * Nome de cada tipo de callout no idioma do app, como na leitura (M7), também para os apelidos
 * (`warning`, `aviso`, `caution`…). As chaves vão em minúsculas: o editor procura pelo tipo escrito.
 */
export function calloutLabels(t: TFunction): Record<string, string> {
  return Object.fromEntries(
    Object.entries(CALLOUT_ALIASES).map(([alias, type]) => [alias, t(`callouts.${type}`)]),
  );
}
