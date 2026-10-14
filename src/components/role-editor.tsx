import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { GRANTABLE, OWN_RULE, type Permission } from '@/lib/permissions';

type Level = 'no' | 'own' | 'yes';

const levelOf = (grants: readonly string[], permission: Permission): Level =>
  grants.includes(permission) ? 'yes' : grants.includes(`${permission}:own`) ? 'own' : 'no';

/** Chave do i18n do nome da permissão (o ponto vira _: o i18next usa ponto para aninhar). */
export const permissionLabelKey = (permission: Permission) =>
  `perm.${permission.replace('.', '_')}` as `perm.${string}`;

/** Monta um cargo personalizado: nome e, para cada permissão, Não / Só as suas / Sim. */
export function RoleEditor({
  initialName = '',
  initialGrants = ['project.view', 'comment.create'],
  saving,
  onSave,
  onCancel,
}: {
  initialName?: string;
  initialGrants?: readonly string[];
  saving?: boolean;
  onSave: (role: { name: string; grants: string[] }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [grants, setGrants] = useState<string[]>([...initialGrants]);

  function set(permission: Permission, level: Level) {
    setGrants((current) => {
      const rest = current.filter((g) => g !== permission && g !== `${permission}:own`);
      if (level === 'yes') return [...rest, permission];
      if (level === 'own') return [...rest, `${permission}:own`];
      return rest;
    });
  }

  return (
    <View className="gap-4 rounded border border-line bg-surface p-3">
      <Input
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoFocus
        placeholder={t('team.roleName')}
        accessibilityLabel={t('team.roleName')}
      />
      {GRANTABLE.map((permission) => {
        const own = OWN_RULE[permission as keyof typeof OWN_RULE];
        const level = levelOf(grants, permission);
        // Ver o projeto vem em todo cargo
        const fixed = permission === 'project.view';
        const levels: Level[] = own ? ['no', 'own', 'yes'] : ['no', 'yes'];
        const label = t(permissionLabelKey(permission) as 'perm.task_create');
        return (
          <View key={permission} className="gap-2">
            <Text className="text-sm text-ink">{label}</Text>
            <View
              className="flex-row flex-wrap gap-2"
              accessibilityRole="radiogroup"
              accessibilityLabel={label}
            >
              {levels.map((l) => (
                <Chip
                  key={l}
                  role="radio"
                  label={t(
                    l === 'yes'
                      ? 'team.grantYes'
                      : l === 'no'
                        ? 'team.grantNo'
                        : own === 'assigned'
                          ? 'team.grantOwnAssigned'
                          : 'team.grantOwnCreated',
                  )}
                  selected={fixed ? l === 'yes' : level === l}
                  disabled={fixed}
                  onPress={() => set(permission, l)}
                />
              ))}
            </View>
          </View>
        );
      })}
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('team.cancel')} onPress={onCancel} />
        <Button
          label={t('team.save')}
          loading={saving}
          disabled={!name.trim()}
          onPress={() => onSave({ name: name.trim(), grants })}
        />
      </View>
    </View>
  );
}
