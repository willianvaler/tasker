import { router } from 'expo-router';
import { Globe, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ItemIcon } from '@/components/item-icon';
import { PublishDialog } from '@/components/publish-dialog';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { PromptDialog, useDialog } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useToday } from '@/lib/queries/profile';
import { useTemplateMutations, useUserTemplates, type TemplateData } from '@/lib/queries/projects';
import { BUILT_IN_TEMPLATES, templateData } from '@/lib/templates';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

type Chosen = { name: string; icon: string; data: TemplateData; shared: boolean };

// Criar projeto a partir de modelo: os prontos (no app) e os salvos pelo usuário.
export default function TemplatesScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const online = useIsOnline();
  const toast = useToast();
  const mine = useUserTemplates();
  const m = useTemplateMutations();
  const [chosen, setChosen, close] = useDialog<Chosen>();
  const [publishing, setPublishing] = useState<{
    id: string;
    name: string;
    icon: string | null;
  } | null>(null);

  return (
    <Screen size="medium">
      <ScreenHeader title={t('templates.title')} back />
      <ScreenScroll contentContainerClassName="pb-12">
        <Button
          variant="ghost"
          icon={Globe}
          className="mb-2 self-start"
          label={t('templates.community')}
          onPress={() => router.push('/comunidade')}
        />
        <View className="border-t border-line">
          {BUILT_IN_TEMPLATES.map((tpl) => (
            <TemplateRow
              key={tpl.key}
              icon={tpl.icon}
              name={tpl.name}
              detail={tpl.description}
              pages={tpl.pages.map((p) => p.name)}
              disabled={!online}
              // Modelos prontos são de projeto: já nascem compartilháveis (o @nome vira responsável)
              onPress={() =>
                setChosen({
                  name: tpl.name,
                  icon: tpl.icon,
                  data: templateData(tpl, today),
                  shared: true,
                })
              }
            />
          ))}
        </View>

        {(mine.data?.length ?? 0) > 0 && (
          <SectionLabel title={t('templates.mine')} count={mine.data?.length} />
        )}
        {mine.data?.map((tpl) => {
          const data = tpl.data as unknown as TemplateData;
          return (
            <TemplateRow
              key={tpl.id}
              icon={tpl.icon}
              name={tpl.name}
              pages={data.pages.map((p) => p.name)}
              disabled={!online}
              onPress={() =>
                setChosen({ name: tpl.name, icon: tpl.icon ?? '', data, shared: false })
              }
              onDelete={() => m.remove.mutate(tpl.id)}
              onPublish={
                online
                  ? () => setPublishing({ id: tpl.id, name: tpl.name, icon: tpl.icon })
                  : undefined
              }
            />
          );
        })}
      </ScreenScroll>

      {publishing && (
        <PublishDialog
          source={{ templateId: publishing.id }}
          name={publishing.name}
          icon={publishing.icon}
          kind="project"
          onClose={() => setPublishing(null)}
        />
      )}
      {chosen && (
        <PromptDialog
          title={t('templates.newProject', { name: chosen.name })}
          confirmLabel={t('templates.create')}
          fields={[
            { key: 'name', placeholder: t('templates.name'), initial: chosen.name },
            { key: 'icon', placeholder: t('templates.emoji'), initial: chosen.icon, maxLength: 8 },
          ]}
          onClose={close}
          onConfirm={({ name, icon }) => {
            close();
            m.createFrom.mutate(
              { ...chosen, name, icon },
              {
                onSuccess: (id) => router.replace({ pathname: '/folder/[id]', params: { id } }),
                onError: (err) =>
                  toast({ message: t('templates.error', { message: err.message }) }),
              },
            );
          }}
        />
      )}
    </Screen>
  );
}

function TemplateRow({
  icon,
  name,
  detail,
  pages,
  disabled,
  onPress,
  onDelete,
  onPublish,
}: {
  icon?: string | null;
  name: string;
  detail?: string;
  pages: string[];
  disabled?: boolean;
  onPress: () => void;
  onDelete?: () => void;
  onPublish?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center border-b border-line">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('templates.label', { name })}
        disabled={disabled}
        className="flex-1 flex-row items-start gap-3 px-2 py-4 hover:bg-wash active:bg-wash"
        onPress={onPress}
      >
        <View className="pt-1">
          <ItemIcon icon={icon} kind="project" size={20} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-serif text-lg text-ink">{name}</Text>
          {detail && <Text className="text-sm text-ink-muted">{detail}</Text>}
          <Text className="font-mono text-xs text-ink-muted">
            {t('templates.pages', { names: pages.join(', ') })}
          </Text>
        </View>
      </Pressable>
      {onPublish && (
        <IconButton icon={Globe} label={t('templates.publish', { name })} onPress={onPublish} />
      )}
      {onDelete && (
        <IconButton icon={X} label={t('templates.delete', { name })} onPress={onDelete} />
      )}
    </View>
  );
}
