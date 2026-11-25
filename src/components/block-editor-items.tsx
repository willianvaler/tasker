import { useTranslation } from 'react-i18next';

import type { SlashId, SlashItem } from '@/lib/block-editor/slash';

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
