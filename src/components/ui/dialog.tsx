import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';

import { Button } from './button';
import { Input } from './input';
import { MenuItem } from './popover';
import { Text } from './text';
import { cn } from '@/lib/cn';

// Diálogos próprios: o Alert do React Native não tem botões na web.

function Backdrop({
  onClose,
  wide,
  children,
}: {
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
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
        <View
          className={cn(
            'max-h-[90%] w-full gap-4 rounded-lg border border-line bg-surface p-4',
            wide ? 'max-w-lg' : 'max-w-sm',
          )}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Diálogo livre (conteúdo próprio), com o mesmo fundo e fechamento dos outros. */
export const DialogFrame = Backdrop;

export type PromptField = {
  key: string;
  placeholder: string;
  initial?: string;
  maxLength?: number;
};

export function PromptDialog({
  title,
  message,
  fields,
  confirmLabel,
  validate,
  onConfirm,
  onClose,
}: {
  title: string;
  /** Texto acima dos campos (ex.: o que se perde numa ação forte) */
  message?: string;
  fields: PromptField[];
  confirmLabel?: string;
  /** Só confirma quando devolve true (ex.: digitar uma palavra para confirmar) */
  validate?: (values: Record<string, string>) => boolean;
  onConfirm: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])),
  );
  const first = fields[0]?.key;
  const valid = validate ? validate(values) : !first || values[first].trim().length > 0;

  function confirm() {
    if (!valid) return;
    onConfirm(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
  }

  return (
    <Backdrop onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      {message && <Text className="text-sm text-ink-muted">{message}</Text>}
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
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={confirmLabel ?? t('common.save')} onPress={confirm} disabled={!valid} />
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
  const { t } = useTranslation();
  return (
    <Backdrop onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      {message && <Text className="text-ink-muted">{message}</Text>}
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={confirmLabel} onPress={onConfirm} />
      </View>
    </Backdrop>
  );
}

export type MenuAction = { label: string; onPress: () => void; destructive?: boolean };

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
      <Text
        className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        numberOfLines={1}
      >
        {title}
      </Text>
      <View>
        {actions.map((action) => (
          <MenuItem
            key={action.label}
            label={action.label}
            danger={action.destructive}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          />
        ))}
      </View>
    </Backdrop>
  );
}

export function useDialog<T>() {
  const [dialog, setDialog] = useState<T | null>(null);
  return [dialog, setDialog, () => setDialog(null)] as const;
}

export function useCloseWhen(when: boolean, close: () => void) {
  useEffect(() => {
    if (when) close();
  }, [when, close]);
}
