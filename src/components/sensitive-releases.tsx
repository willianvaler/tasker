import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useSensitiveReleaseActions, useSensitiveReleases } from '@/lib/queries/sensitive';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/**
 * Dado sensível em webhook (SA0, V15-4): saúde, local, câmera e dispositivo ficam bloqueados nas
 * automações que mandam para fora; aqui a pessoa libera campo a campo (o motor confere no servidor).
 */
export function SensitiveReleases() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const toast = useToast();
  const list = useSensitiveReleases();
  const m = useSensitiveReleaseActions();
  const [field, setField] = useState('');
  const onError = (e: Error) => toast({ message: e.message });

  function add() {
    const value = field.trim();
    if (!value) return;
    m.add
      .mutateAsync(value)
      .then(() => setField(''))
      .catch(onError);
  }

  return (
    <View className="gap-2">
      <Text className="font-semibold text-ink">{t('sensitive.title')}</Text>
      <Text className="text-sm text-ink-muted">{t('sensitive.hint')}</Text>
      {(list.data ?? []).length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('sensitive.none')}</Text>
      ) : (
        <View accessibilityLabel={t('sensitive.listLabel')}>
          {(list.data ?? []).map((f) => (
            <View key={f} className="min-h-10 flex-row items-center gap-2 border-b border-line">
              <Text className="flex-1 font-mono text-sm text-ink">{f}</Text>
              <IconButton
                icon={X}
                tone="danger"
                label={t('sensitive.remove', { field: f })}
                disabled={!online}
                onPress={() => m.remove.mutate(f, { onError })}
              />
            </View>
          ))}
        </View>
      )}
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="min-w-48 flex-1">
          <Input
            value={field}
            onChangeText={setField}
            placeholder={t('sensitive.placeholder')}
            accessibilityLabel={t('sensitive.fieldLabel')}
            autoCapitalize="none"
            onSubmitEditing={add}
          />
        </View>
        <Button
          variant="ghost"
          label={t('sensitive.add')}
          disabled={!online || !field.trim()}
          loading={m.add.isPending}
          onPress={add}
        />
      </View>
    </View>
  );
}
