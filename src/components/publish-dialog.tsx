import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  COMMUNITY_KINDS,
  useCommunityActions,
  type CommunityKind,
  type PublishSource,
} from '@/lib/queries/community';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/**
 * Publicar na comunidade (D233): título, descrição e tipo. Vai uma cópia da estrutura, sem
 * pessoas, datas, comentários, anexos nem gastos (o texto do diálogo diz isso).
 */
export function PublishDialog({
  source,
  name,
  icon,
  kind: initialKind,
  onClose,
}: {
  source: PublishSource;
  name: string;
  icon?: string | null;
  kind: CommunityKind;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const { publish } = useCommunityActions();
  const [title, setTitle] = useState(name);
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<CommunityKind>(initialKind);

  function submit() {
    if (!title.trim()) return;
    publish.mutate(
      {
        source,
        kind,
        title: title.trim(),
        description: description.trim(),
        icon: icon ?? null,
        locale: i18n.language,
      },
      {
        onSuccess: (id) => {
          onClose();
          toast({ message: t('publish.done', { title: title.trim() }) });
          if (id) router.push({ pathname: '/comunidade/[id]', params: { id } });
        },
        onError: (err) => toast({ message: err.message }),
      },
    );
  }

  return (
    <DialogFrame onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">{t('publish.title')}</Text>
      <Text className="text-sm text-ink-muted">{t('publish.hint')}</Text>
      <Input
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholder={t('publish.titlePlaceholder')}
        accessibilityLabel={t('publish.titleLabel')}
      />
      <Input
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        className="min-h-16"
        placeholder={t('publish.descriptionPlaceholder')}
        accessibilityLabel={t('publish.descriptionLabel')}
      />
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {COMMUNITY_KINDS.map((k) => (
          <Chip
            key={k}
            role="radio"
            label={t(`community.kind.${k}`)}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button
          label={t('publish.confirm')}
          loading={publish.isPending}
          disabled={!online || !title.trim()}
          onPress={submit}
        />
      </View>
    </DialogFrame>
  );
}

/** Tipo sugerido pelo que se publica. */
export function suggestedKind(
  page?: { view_type: string } | null,
  workout?: boolean,
): CommunityKind {
  if (workout) return 'workout';
  if (page?.view_type === 'habits') return 'habits';
  return page ? 'list' : 'project';
}
