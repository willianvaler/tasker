import { ArrowDown, ArrowUp, Eye, EyeOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { cn } from '@/lib/cn';
import { useProfile, useSetGymMode, useUiPrefs, useUpdateUiPrefs } from '@/lib/queries/profile';
import { moveBlock, resolveBlocks, toggleHidden, type SidebarBlock } from '@/lib/sidebar-blocks';
import { useIsOnline } from '@/providers/online';

/** Blocos que a conta tem: Academia só com o modo academia ligado. */
export function availableBlocks(gymOn: boolean): SidebarBlock[] {
  return ['notes', 'folders', ...(gymOn ? (['gym'] as const) : []), 'projects', 'received'];
}

export function useBlockLabel() {
  const { t } = useTranslation();
  return (block: SidebarBlock) =>
    ({
      notes: t('notes.title'),
      gym: t('gym.block'),
      folders: t('nav.folders'),
      projects: t('nav.projects'),
      received: t('received.title'),
    })[block];
}

/** Configurações → Recursos: treino (o antigo "modo academia", V6 §15.1). */
export function GymToggle() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const profile = useProfile();
  const setGymMode = useSetGymMode();
  return (
    <ToggleRow
      title={t('gym.toggle')}
      hint={t('gym.toggleHint')}
      value={profile.data?.gym_enabled === true}
      disabled={!online || setGymMode.isPending || !profile.data}
      onChange={(value) => setGymMode.mutate(value)}
    />
  );
}

/**
 * Configurações → Recursos (D270): a Academia mora dentro do Bem-estar, em vez de ter o bloco da
 * barra lateral, a seção da tela Pastas e uma posição própria na barra de baixo.
 */
export function WellnessGymToggle() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const profile = useProfile();
  const prefs = useUiPrefs();
  const update = useUpdateUiPrefs();
  if (profile.data?.gym_enabled !== true) return null;
  return (
    <ToggleRow
      title={t('wellness.gymInside')}
      hint={t('wellness.gymInsideHint')}
      value={prefs.wellness?.gym === true}
      disabled={!online || update.isPending}
      onChange={(value) => update.mutate({ wellness: { ...prefs.wellness, gym: value } })}
    />
  );
}

/**
 * Configurações → Navegação (V6 §15.2): a ordem dos blocos da barra lateral, com subir, descer e
 * esconder. Salva no perfil, então vale em todos os aparelhos.
 */
export function SidebarSettings() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const profile = useProfile();
  const gymInWellness = useUiPrefs().wellness?.gym === true;
  const prefs = useUiPrefs().sidebar ?? {};
  const update = useUpdateUiPrefs();
  const label = useBlockLabel();
  // Academia dentro do Bem-estar (D270): o bloco não está na barra lateral
  const gymOn = profile.data?.gym_enabled === true && !gymInWellness;

  // Todos os blocos na ordem salva, inclusive os escondidos (para poder mostrar de novo)
  const order = resolveBlocks({ order: prefs.order }, availableBlocks(gymOn));
  const hidden = new Set(prefs.hidden ?? []);
  const disabled = !online || update.isPending;

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-sm text-ink-muted">{t('sidebarPrefs.hint')}</Text>
        {order.map((block, index) => {
          const isHidden = hidden.has(block);
          const name = label(block);
          return (
            <View key={block} className="min-h-10 flex-row items-center gap-1">
              <Text className={cn('flex-1 text-sm text-ink', isHidden && 'text-ink-muted')}>
                {isHidden ? `${name} · ${t('sidebarPrefs.hidden')}` : name}
              </Text>
              <IconButton
                icon={ArrowUp}
                label={t('sidebarPrefs.up', { name })}
                disabled={disabled || index === 0}
                onPress={() =>
                  update.mutate({ sidebar: { ...prefs, order: moveBlock(order, block, -1) } })
                }
              />
              <IconButton
                icon={ArrowDown}
                label={t('sidebarPrefs.down', { name })}
                disabled={disabled || index === order.length - 1}
                onPress={() =>
                  update.mutate({ sidebar: { ...prefs, order: moveBlock(order, block, 1) } })
                }
              />
              <IconButton
                icon={isHidden ? Eye : EyeOff}
                label={t(isHidden ? 'sidebarPrefs.show' : 'sidebarPrefs.hide', { name })}
                disabled={disabled}
                onPress={() => update.mutate({ sidebar: toggleHidden(prefs, block) })}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
