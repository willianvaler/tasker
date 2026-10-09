import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button } from './button';
import { Input } from './input';

// Diálogos próprios: o Alert do React Native não tem botões na web.

function Backdrop({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <Pressable accessibilityLabel="Fechar" className="absolute inset-0" onPress={onClose} />
        <View className="w-full max-w-sm gap-3 rounded-2xl bg-background p-5">{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type PromptField = {
  key: string;
  placeholder: string;
  initial?: string;
  maxLength?: number;
};

export function PromptDialog({
  title,
  fields,
  confirmLabel = 'Salvar',
  onConfirm,
  onClose,
}: {
  title: string;
  fields: PromptField[];
  confirmLabel?: string;
  onConfirm: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])),
  );
  const first = fields[0]?.key;
  const valid = !first || values[first].trim().length > 0;

  function confirm() {
    if (!valid) return;
    onConfirm(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
  }

  return (
    <Backdrop onClose={onClose}>
      <Text className="text-lg font-bold text-foreground">{title}</Text>
      {fields.map((field, index) => (
        <Input
          key={field.key}
          placeholder={field.placeholder}
          value={values[field.key]}
          maxLength={field.maxLength ?? 100}
          autoFocus={index === 0}
          onChangeText={(text) => setValues((v) => ({ ...v, [field.key]: text }))}
          onSubmitEditing={confirm}
        />
      ))}
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label="Cancelar" onPress={onClose} />
        <Button label={confirmLabel} onPress={confirm} disabled={!valid} />
      </View>
    </Backdrop>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Backdrop onClose={onClose}>
      <Text className="text-lg font-bold text-foreground">{title}</Text>
      {message && <Text className="text-muted-foreground">{message}</Text>}
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label="Cancelar" onPress={onClose} />
        <Button variant="destructive" label={confirmLabel} onPress={onConfirm} />
      </View>
    </Backdrop>
  );
}

export type MenuAction = { label: string; onPress: () => void; destructive?: boolean };

/** Menu de ações (o "⋯" das pastas e páginas). */
export function ActionMenu({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: MenuAction[];
  onClose: () => void;
}) {
  return (
    <Backdrop onClose={onClose}>
      <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          className="min-h-11 justify-center rounded-lg px-2 active:bg-muted"
          onPress={() => {
            onClose();
            action.onPress();
          }}
        >
          <Text
            className={
              action.destructive ? 'text-base text-destructive' : 'text-base text-foreground'
            }
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </Backdrop>
  );
}

/** Estado de um diálogo aberto por vez; `null` fecha. */
export function useDialog<T>() {
  const [dialog, setDialog] = useState<T | null>(null);
  return [dialog, setDialog, () => setDialog(null)] as const;
}

/** Fecha o diálogo quando `when` passa a ser verdadeiro (ex.: depois de salvar). */
export function useCloseWhen(when: boolean, close: () => void) {
  useEffect(() => {
    if (when) close();
  }, [when, close]);
}
