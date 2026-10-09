import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import type { Page, PageSettings } from '@/lib/queries/tree';

const VIEW_TYPES: { value: Page['view_type']; label: string; hint: string }[] = [
  { value: 'list', label: '📄 Lista', hint: 'Uma tarefa por linha.' },
  {
    value: 'cards',
    label: '🃏 Cards',
    hint: 'Cards grandes para marcar rápido (treino, rotina). Toque no card inteiro.',
  },
  {
    value: 'habits',
    label: '🔥 Hábitos',
    hint: 'Itens que se repetem, com sequência e histórico.',
  },
  {
    value: 'kanban',
    label: '📋 Kanban',
    hint: 'Colunas A fazer, Fazendo e Feito. Bom para projetos com etapas.',
  },
];

const RESET_CYCLES: { value: Page['reset_cycle']; label: string }[] = [
  { value: 'none', label: 'Nunca' },
  { value: 'daily', label: 'Todo dia' },
  { value: 'weekly', label: 'Toda segunda' },
  { value: 'manual', label: 'Manual' },
];

/** Criar ou configurar uma página: nome, ícone, tipo de visualização e quando os checks reiniciam. */
export function PageDialog({
  title,
  initial,
  onConfirm,
  onClose,
}: {
  title: string;
  initial?: Partial<Page>;
  onConfirm: (settings: PageSettings) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [viewType, setViewType] = useState<Page['view_type']>(initial?.view_type ?? 'list');
  // Cards nascem com reset semanal (o caso do treino); listas, sem reset
  const [resetCycle, setResetCycle] = useState<Page['reset_cycle'] | null>(
    initial?.reset_cycle ?? null,
  );
  const effectiveReset = resetCycle ?? (viewType === 'cards' ? 'weekly' : 'none');

  function confirm() {
    if (!name.trim()) return;
    onConfirm({
      name: name.trim(),
      icon: icon.trim(),
      view_type: viewType,
      // Hábitos reiniciam pela recorrência de cada item; o ciclo da página não se aplica
      // Hábitos têm o ciclo de cada item; kanban é fluxo, não rotina: nunca reiniciam
      reset_cycle: viewType === 'habits' || viewType === 'kanban' ? 'none' : effectiveReset,
    });
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <Pressable accessibilityLabel="Fechar" className="absolute inset-0" onPress={onClose} />
        <View className="max-h-[90%] w-full max-w-md rounded-2xl bg-background">
          <ScrollView contentContainerClassName="gap-3 p-5" keyboardShouldPersistTaps="handled">
            <Text className="text-lg font-bold text-foreground">{title}</Text>
            <Input
              placeholder="Nome (ex.: Treino A)"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={100}
            />
            <Input
              placeholder="Emoji (opcional)"
              value={icon}
              onChangeText={setIcon}
              maxLength={8}
            />

            <Text className="font-semibold text-foreground">Tipo</Text>
            <View className="flex-row flex-wrap gap-2">
              {VIEW_TYPES.map((t) => (
                <Chip
                  key={t.value}
                  role="radio"
                  label={t.label}
                  selected={viewType === t.value}
                  onPress={() => setViewType(t.value)}
                />
              ))}
            </View>
            <Text className="text-sm text-muted-foreground">
              {VIEW_TYPES.find((t) => t.value === viewType)?.hint}
            </Text>

            {viewType !== 'habits' && viewType !== 'kanban' && (
              <>
                <Text className="font-semibold text-foreground">Reiniciar os checks</Text>
                <View className="flex-row flex-wrap gap-2">
                  {RESET_CYCLES.map((c) => (
                    <Chip
                      key={c.value}
                      role="radio"
                      label={c.label}
                      selected={effectiveReset === c.value}
                      onPress={() => setResetCycle(c.value)}
                    />
                  ))}
                </View>
                <Text className="text-sm text-muted-foreground">
                  {effectiveReset === 'none'
                    ? 'O que for marcado fica marcado.'
                    : effectiveReset === 'manual'
                      ? 'Os checks voltam quando você tocar em "Reiniciar". O histórico fica guardado.'
                      : 'Os checks voltam sozinhos; o histórico fica guardado.'}
                </Text>
              </>
            )}

            <View className="mt-2 flex-row justify-end gap-2">
              <Button variant="ghost" label="Cancelar" onPress={onClose} />
              <Button label="Salvar" onPress={confirm} disabled={!name.trim()} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function resetCycleLabel(cycle: Page['reset_cycle']) {
  return {
    none: '',
    daily: 'Reinicia todo dia',
    weekly: 'Reinicia toda segunda',
    manual: 'Reinício manual',
  }[cycle];
}
