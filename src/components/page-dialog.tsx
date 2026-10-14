import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DepthPicker } from '@/components/depth-picker';
import { DEFAULT_MAX_DEPTH } from '@/config/limits';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { IconPicker } from '@/components/icon-picker';
import type { ItemKind } from '@/components/item-icon';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { Page, PageSettings } from '@/lib/queries/tree';

const VIEW_TYPES = [
  { value: 'list', label: 'pageDialog.list', hint: 'pageDialog.listHint' },
  { value: 'cards', label: 'pageDialog.cards', hint: 'pageDialog.cardsHint' },
  { value: 'habits', label: 'pageDialog.habits', hint: 'pageDialog.habitsHint' },
  { value: 'kanban', label: 'pageDialog.kanban', hint: 'pageDialog.kanbanHint' },
] as const satisfies readonly { value: Page['view_type']; label: string; hint: string }[];

const RESET_CYCLES = [
  { value: 'none', label: 'pageDialog.never' },
  { value: 'daily', label: 'pageDialog.daily' },
  { value: 'weekly', label: 'pageDialog.weekly' },
  { value: 'manual', label: 'pageDialog.manual' },
] as const satisfies readonly { value: Page['reset_cycle']; label: string }[];

/** Criar ou configurar uma página: nome, ícone, tipo de visualização e quando os checks reiniciam. */
export function PageDialog({
  title,
  initial,
  inheritedDepth = DEFAULT_MAX_DEPTH,
  extra,
  onConfirm,
  onClose,
}: {
  title: string;
  initial?: Partial<Page>;
  /** O limite que vale se a página ficar no padrão (o do projeto) */
  inheritedDepth?: number;
  /** Seções que salvam sozinhas (ex.: "Libera depois de", só ao configurar lista de projeto) */
  extra?: { label: string; content: React.ReactNode };
  onConfirm: (settings: PageSettings) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [viewType, setViewType] = useState<Page['view_type']>(initial?.view_type ?? 'list');
  // Cards nascem com reset semanal (o caso do treino); listas, sem reset
  const [resetCycle, setResetCycle] = useState<Page['reset_cycle'] | null>(
    initial?.reset_cycle ?? null,
  );
  const effectiveReset = resetCycle ?? (viewType === 'cards' ? 'weekly' : 'none');
  const [maxDepth, setMaxDepth] = useState<number | null>(initial?.max_depth ?? null);

  function confirm() {
    if (!name.trim()) return;
    onConfirm({
      name: name.trim(),
      icon: icon.trim(),
      view_type: viewType,
      // Hábitos reiniciam pela recorrência de cada item; o ciclo da página não se aplica
      // Hábitos têm o ciclo de cada item; kanban é fluxo, não rotina: nunca reiniciam
      reset_cycle: viewType === 'habits' || viewType === 'kanban' ? 'none' : effectiveReset,
      max_depth: maxDepth,
    });
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-scrim/40 px-6"
      >
        <Pressable
          accessibilityLabel={t('common.close')}
          className="absolute inset-0"
          onPress={onClose}
        />
        <View className="max-h-[90%] w-full max-w-md rounded-lg border border-line bg-surface">
          <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
            <Text className="text-lg font-semibold text-ink">{title}</Text>
            <Input
              placeholder={t('pageDialog.namePlaceholder')}
              value={name}
              onChangeText={setName}
              onSubmitEditing={confirm}
              autoFocus
              maxLength={100}
            />
            <Label>{t('iconPicker.label')}</Label>
            <IconPicker
              value={icon || null}
              kind={viewType as ItemKind}
              onChange={(value) => setIcon(value ?? '')}
            />

            <Label>{t('pageDialog.type')}</Label>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {VIEW_TYPES.map((v) => (
                <Chip
                  key={v.value}
                  role="radio"
                  label={t(v.label)}
                  selected={viewType === v.value}
                  onPress={() => setViewType(v.value)}
                />
              ))}
            </View>
            <Text className="text-sm text-ink-muted">
              {t(VIEW_TYPES.find((v) => v.value === viewType)?.hint ?? 'pageDialog.listHint')}
            </Text>

            {viewType !== 'habits' && viewType !== 'kanban' && (
              <>
                <Label>{t('pageDialog.reset')}</Label>
                <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
                  {RESET_CYCLES.map((c) => (
                    <Chip
                      key={c.value}
                      role="radio"
                      label={t(c.label)}
                      selected={effectiveReset === c.value}
                      onPress={() => setResetCycle(c.value)}
                    />
                  ))}
                </View>
                <Text className="text-sm text-ink-muted">
                  {t(
                    effectiveReset === 'none'
                      ? 'pageDialog.resetNone'
                      : effectiveReset === 'manual'
                        ? 'pageDialog.resetManual'
                        : 'pageDialog.resetAuto',
                  )}
                </Text>
              </>
            )}

            {viewType !== 'habits' && (
              <>
                <Label>{t('tree.depthLimit')}</Label>
                <DepthPicker value={maxDepth} inherited={inheritedDepth} onChange={setMaxDepth} />
                <Text className="text-sm text-ink-muted">{t('tree.depthHint')}</Text>
              </>
            )}

            {extra && (
              <>
                <Label>{extra.label}</Label>
                {extra.content}
              </>
            )}

            <View className="mt-2 flex-row justify-end gap-2">
              <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
              <Button label={t('common.save')} onPress={confirm} disabled={!name.trim()} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</Text>
  );
}

/** "Reinicia toda segunda" (vazio quando a página não reinicia). */
export function resetCycleLabel(cycle: Page['reset_cycle'], t: TFunction) {
  return {
    none: '',
    daily: t('pageDialog.labelDaily'),
    weekly: t('pageDialog.labelWeekly'),
    manual: t('pageDialog.labelManual'),
  }[cycle];
}
