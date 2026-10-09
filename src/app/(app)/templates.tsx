import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PromptDialog, useDialog } from '@/components/ui/dialog';
import { useToday } from '@/lib/queries/profile';
import { useTemplateMutations, useUserTemplates, type TemplateData } from '@/lib/queries/projects';
import { BUILT_IN_TEMPLATES, templateData } from '@/lib/templates';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

type Chosen = { name: string; icon: string; data: TemplateData; shared: boolean };

// Criar projeto a partir de modelo (ESCOPO 4.5): os prontos (no app) e os salvos pelo usuário.
export default function TemplatesScreen() {
  const today = useToday();
  const online = useIsOnline();
  const toast = useToast();
  const mine = useUserTemplates();
  const m = useTemplateMutations();
  const [chosen, setChosen, close] = useDialog<Chosen>();

  return (
    <Screen>
      <ScreenHeader title="Usar modelo" back />
      <ScrollView contentContainerClassName="gap-3 pb-12">
        {BUILT_IN_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.key}
            icon={t.icon}
            name={t.name}
            detail={t.description}
            pages={t.pages.map((p) => p.name)}
            disabled={!online}
            // Modelos prontos são de projeto: já nascem compartilháveis (o @nome vira responsável)
            onPress={() =>
              setChosen({ name: t.name, icon: t.icon, data: templateData(t, today), shared: true })
            }
          />
        ))}

        {(mine.data?.length ?? 0) > 0 && (
          <Text className="mt-4 font-semibold text-foreground">Meus modelos</Text>
        )}
        {mine.data?.map((t) => {
          const data = t.data as unknown as TemplateData;
          return (
            <TemplateCard
              key={t.id}
              icon={t.icon || '📁'}
              name={t.name}
              pages={data.pages.map((p) => p.name)}
              disabled={!online}
              onPress={() => setChosen({ name: t.name, icon: t.icon ?? '', data, shared: false })}
              onDelete={() => m.remove.mutate(t.id)}
            />
          );
        })}
      </ScrollView>

      {chosen && (
        <PromptDialog
          title={`Novo projeto: ${chosen.icon} ${chosen.name}`}
          confirmLabel="Criar"
          fields={[
            { key: 'name', placeholder: 'Nome', initial: chosen.name },
            { key: 'icon', placeholder: 'Emoji', initial: chosen.icon, maxLength: 8 },
          ]}
          onClose={close}
          onConfirm={({ name, icon }) => {
            close();
            m.createFrom.mutate(
              { ...chosen, name, icon },
              {
                onSuccess: (id) => router.replace({ pathname: '/folder/[id]', params: { id } }),
                onError: (err) => toast({ message: `Não deu certo: ${err.message}` }),
              },
            );
          }}
        />
      )}
    </Screen>
  );
}

function TemplateCard({
  icon,
  name,
  detail,
  pages,
  disabled,
  onPress,
  onDelete,
}: {
  icon: string;
  name: string;
  detail?: string;
  pages: string[];
  disabled?: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <View className="flex-row items-center rounded-2xl border border-border bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Modelo ${name}`}
        disabled={disabled}
        className="flex-1 gap-1 p-4 active:opacity-70"
        onPress={onPress}
      >
        <Text className="text-lg font-semibold text-foreground">
          {icon} {name}
        </Text>
        {detail && <Text className="text-sm text-muted-foreground">{detail}</Text>}
        <Text className="text-xs text-muted-foreground">Páginas: {pages.join(', ')}</Text>
      </Pressable>
      {onDelete && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Apagar modelo ${name}`}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
          onPress={onDelete}
        >
          <Text className="text-muted-foreground">✕</Text>
        </Pressable>
      )}
    </View>
  );
}
