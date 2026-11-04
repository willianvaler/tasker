import { FileText, List, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { BaseView } from '@/components/base-view';
import { CanvasView } from '@/components/canvas/canvas-view';
import { ExpensesView } from '@/components/expenses/expenses-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PageView } from '@/components/tasks/page-view';
import { Button, IconButton } from '@/components/ui/button';
import { DialogFrame } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useLinkCandidates } from '@/lib/queries/links';
import { pageLabel, useTree } from '@/lib/queries/tree';

// Tela dividida no computador (OB12, ESCOPO_V11 §7, D297): a anotação à esquerda e outra
// anotação ou uma lista à direita. O que está ao lado fica no endereço (`?lado=n:<id>` ou
// `p:<id>`), então recarregar mantém as duas.

/** A partir daqui cabem duas colunas de texto lado a lado */
export const SPLIT_MIN = 1024;
export const useCanSplit = () => useWindowDimensions().width >= SPLIT_MIN;

export type SideRef = { kind: 'note' | 'page'; id: string };
export function parseSide(value: string | undefined): SideRef | null {
  const m = /^([np]):([0-9a-f-]{36})$/i.exec(value ?? '');
  if (!m) return null;
  return { kind: m[1] === 'n' ? 'note' : 'page', id: m[2].toLowerCase() };
}
export const sideParam = (side: SideRef) => `${side.kind === 'note' ? 'n' : 'p'}:${side.id}`;

/** Escolher a anotação ou a lista que abre ao lado */
export function SidePicker({
  exclude,
  onPick,
  onClose,
}: {
  exclude: string;
  onPick: (side: SideRef) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const list = useLinkCandidates(text, exclude).filter(
    (c) => c.kind === 'note' || c.kind === 'page',
  );
  return (
    <DialogFrame onClose={onClose} wide>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {t('sidePane.pick')}
      </Text>
      <Input
        autoFocus
        accessibilityLabel={t('sidePane.search')}
        placeholder={t('sidePane.search')}
        value={text}
        onChangeText={setText}
      />
      <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
        {list.length === 0 && (
          <Text className="py-2 text-sm text-ink-muted">{t('sidePane.searchHint')}</Text>
        )}
        {list.map((c) => (
          <Pressable
            key={`${c.kind}:${c.id}`}
            accessibilityRole="button"
            onPress={() => onPick({ kind: c.kind as SideRef['kind'], id: c.id })}
            className="min-h-10 flex-row items-center gap-2 rounded px-2 py-2 hover:bg-wash"
          >
            <Icon icon={c.kind === 'note' ? FileText : List} size={16} tone="ink-muted" />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm text-ink">
                {c.title}
              </Text>
              {!!c.context && (
                <Text numberOfLines={1} className="text-xs text-ink-muted">
                  {c.context}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Button variant="ghost" label={t('common.cancel')} onPress={onClose} className="self-end" />
    </DialogFrame>
  );
}

/** Botão de fechar o lado */
export function CloseSide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return <IconButton icon={X} label={t('sidePane.close')} tone="ink" onPress={onClose} />;
}

/** A lista ao lado, na visão dela (lista, quadro, hábitos, base, canvas, gastos) */
export function PagePane({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const tree = useTree();
  const page = tree.data?.pages.find((p) => p.id === id);
  return (
    <Screen size="medium">
      <ScreenHeader
        title={page ? pageLabel(page) : t('sidePane.title')}
        right={<CloseSide onClose={onClose} />}
      />
      {tree.data && !page ? (
        <EmptyState title={t('sidePane.missing')} />
      ) : !page ? null : page.view_type === 'expenses' ? (
        <ExpensesView page={page} />
      ) : page.view_type === 'base' ? (
        <BaseView page={page} />
      ) : page.view_type === 'canvas' ? (
        <CanvasView page={page} />
      ) : (
        <PageView page={page} />
      )}
    </Screen>
  );
}
