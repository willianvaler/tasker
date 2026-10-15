import { router } from 'expo-router';
import { ChevronLeft, CircleHelp } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { IconPicker } from '@/components/icon-picker';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { IconButton } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { Text, textClass } from '@/components/ui/text';
import { selection, useSelection } from '@/lib/selection';

/** Renomear pelo cabeçalho (F2 ou toque longo no título), com o seletor de ícone ao lado. */
export type HeaderRename = {
  target: { kind: 'page' | 'folder'; id: string };
  icon: string | null;
  iconKind: ItemKind;
  color?: string | null;
  onSave: (patch: { name: string; icon: string | null; color?: string | null }) => void;
};

/**
 * Cabeçalho de tela: linha de contexto pequena em mono e caixa-alta (data, caminho,
 * resumo), título serifado de 28 px e as ações à direita.
 */
export function ScreenHeader({
  title,
  eyebrow,
  back,
  icon,
  right,
  rename,
  help,
  wrap,
}: {
  title: string;
  /** Contexto acima do título: "TER, 13 OUT", "PASTAS / MERCADO" */
  eyebrow?: string;
  back?: boolean;
  icon?: ReactNode;
  right?: ReactNode;
  /** Permite renomear (F2) */
  rename?: HeaderRename;
  /** Artigo da Ajuda sobre a tela: mostra o "?" (F2, D146) */
  help?: string;
  /** Título longo (artigo da Ajuda) quebra a linha em vez de cortar */
  wrap?: boolean;
}) {
  const { t } = useTranslation();
  const requested = useSelection(
    (s) => !!rename && s.rename?.kind === rename.target.kind && s.rename.id === rename.target.id,
  );
  return (
    <View className="flex-row items-end gap-2 pb-4 pt-4 md:pt-8">
      {back && (
        <View className="-ml-3 md:-ml-2">
          <IconButton
            icon={ChevronLeft}
            label={t('common.back')}
            tone="ink"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      )}
      <View className="flex-1">
        {eyebrow && (
          <Text className="font-mono text-xs uppercase text-ink-muted" numberOfLines={1}>
            {eyebrow}
          </Text>
        )}
        {requested && rename ? (
          <RenameField title={title} rename={rename} />
        ) : (
          <View className="flex-row items-center gap-2">
            {icon}
            <Pressable
              className="flex-1"
              disabled={!rename}
              accessible={false}
              // Toque longo no título também renomeia (no celular não há F2)
              onLongPress={() => rename && selection.rename(rename.target)}
            >
              <Text
                className="font-serif text-xl text-ink"
                numberOfLines={wrap ? undefined : 1}
                accessibilityRole="header"
              >
                {title}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      {(right || help) && (
        <View className="flex-row items-center gap-1">
          {right}
          {help && (
            <IconButton
              icon={CircleHelp}
              label={t('help.contextual')}
              onPress={() => router.push({ pathname: '/ajuda/[slug]', params: { slug: help } })}
            />
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Nome editável no lugar do título: o texto vem selecionado, Enter salva, Esc cancela, Tab vai
 * para o ícone, que abre o seletor num popover.
 */
function RenameField({ title, rename }: { title: string; rename: HeaderRename }) {
  const { t } = useTranslation();
  const [name, setName] = useState(title);
  const [icon, setIcon] = useState(rename.icon);
  const [color, setColor] = useState(rename.color ?? null);
  const [picking, setPicking] = useState(false);
  const anchor = useRef<View>(null);

  const finish = () => selection.rename(null);
  function save() {
    const trimmed = name.trim();
    if (trimmed) rename.onSave({ name: trimmed, icon, color });
    finish();
  }

  return (
    <View className="flex-row items-center gap-2">
      <View ref={anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('rename.icon')}
          onPress={() => setPicking(true)}
          className="h-11 w-11 items-center justify-center rounded border border-line hover:bg-wash md:h-8 md:w-8"
        >
          <ItemIcon icon={icon} kind={rename.iconKind} size={20} />
        </Pressable>
      </View>
      <TextInput
        autoFocus
        selectTextOnFocus
        value={name}
        onChangeText={setName}
        onSubmitEditing={save}
        onKeyPress={(e) => e.nativeEvent.key === 'Escape' && finish()}
        accessibilityLabel={t('rename.name')}
        className={textClass(
          'flex-1 rounded border border-accent px-2 py-1 font-serif text-xl text-ink',
        )}
      />
      <Popover anchor={anchor} open={picking} onClose={() => setPicking(false)} width={320}>
        <View className="p-2">
          <IconPicker
            value={icon}
            kind={rename.iconKind}
            onChange={(value) => {
              setIcon(value);
              setPicking(false);
            }}
            color={rename.color !== undefined ? color : undefined}
            onColor={rename.color !== undefined ? setColor : undefined}
            autoFocus
          />
        </View>
      </Popover>
    </View>
  );
}
