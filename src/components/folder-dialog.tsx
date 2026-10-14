import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { IconPicker } from '@/components/icon-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

export type FolderSettings = { name: string; icon: string | null; color: string | null };

/**
 * Criar ou renomear pasta/projeto: só o nome é obrigatório; ícone e cor do marcador
 * ficam logo abaixo, já no seletor (sem campo de emoji para digitar).
 */
export function FolderDialog({
  title,
  placeholder,
  project,
  initial,
  onConfirm,
  onClose,
}: {
  title: string;
  placeholder: string;
  project?: boolean;
  initial?: Partial<FolderSettings>;
  onConfirm: (settings: FolderSettings) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [color, setColor] = useState<string | null>(initial?.color ?? null);

  function confirm() {
    if (!name.trim()) return;
    onConfirm({ name: name.trim(), icon, color });
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
              placeholder={placeholder}
              value={name}
              onChangeText={setName}
              onSubmitEditing={confirm}
              autoFocus
              maxLength={100}
            />
            <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('iconPicker.label')}
            </Text>
            <IconPicker
              value={icon}
              kind={project ? 'project' : 'folder'}
              onChange={setIcon}
              color={color}
              onColor={setColor}
            />
            <View className="flex-row justify-end gap-2">
              <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
              <Button label={t('common.save')} onPress={confirm} disabled={!name.trim()} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
