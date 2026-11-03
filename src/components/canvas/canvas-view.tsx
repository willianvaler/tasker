import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LinkCard, RefCard, useCanvasState } from '@/components/canvas/canvas-parts';
import { ScreenScroll } from '@/components/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cardRef, groupOf, type CanvasNode } from '@/lib/canvas';
import type { Page } from '@/lib/queries/tree';

/**
 * Canvas no celular (OB10): os cartões em lista, por grupo, de cima para baixo e da esquerda para
 * a direita. As tarefas marcam de verdade; arrumar o quadro é no computador (a web).
 */
export function CanvasView({ page }: { page: Page }) {
  const { t } = useTranslation();
  const { canvas } = useCanvasState(page);
  const order = (a: CanvasNode, b: CanvasNode) => a.y - b.y || a.x - b.x;
  const cards = canvas.nodes.filter((n) => n.type !== 'group');
  const groups = canvas.nodes.filter((n) => n.type === 'group').sort(order);
  const byGroup = new Map<string, CanvasNode[]>();
  for (const n of [...cards].sort(order)) {
    const g = groupOf(canvas, n)?.id ?? '';
    byGroup.set(g, [...(byGroup.get(g) ?? []), n]);
  }
  const sections = [
    { id: '', label: '', color: undefined },
    ...groups.map((g) => ({ id: g.id, label: g.label ?? '', color: g.color })),
  ].filter((s) => byGroup.get(s.id)?.length);
  return (
    <ScreenScroll contentContainerClassName="gap-4 pb-clear">
      <Text className="text-sm text-ink-muted">{t('canvas.phoneHint')}</Text>
      {cards.length === 0 && <Text className="text-sm text-ink-muted">{t('canvas.empty')}</Text>}
      {sections.map((s) => (
        <View key={s.id || '-'} className="gap-2">
          {!!s.id && <SectionLabel title={s.label || t('canvas.group')} />}
          {(byGroup.get(s.id) ?? []).map((n) => (
            <Card key={n.id} node={n} />
          ))}
        </View>
      ))}
      {canvas.edges.length > 0 && (
        <Text className="text-xs text-ink-muted">
          {t('canvas.edgesCount', { count: canvas.edges.length })}
        </Text>
      )}
    </ScreenScroll>
  );
}

function Card({ node }: { node: CanvasNode }) {
  const ref = cardRef(node);
  return (
    <View
      className="overflow-hidden rounded-lg border border-line bg-surface"
      style={node.type === 'link' ? { height: Math.min(node.height, 240) } : undefined}
    >
      {ref ? (
        <RefCard kind={ref.kind} id={ref.id} />
      ) : node.type === 'link' ? (
        <LinkCard url={node.url ?? ''} />
      ) : (
        <Text className="p-3 text-sm text-ink">{node.text || node.file}</Text>
      )}
    </View>
  );
}
