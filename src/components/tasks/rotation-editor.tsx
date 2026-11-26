import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTaskMembers } from '@/components/tasks/assignee-chips';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { actorCan } from '@/lib/permissions';
import { useFolderActor } from '@/lib/queries/projects';
import { useRotationMutations, useTaskRotation } from '@/lib/queries/rotation';
import type { Task } from '@/lib/queries/tasks';
import {
  moveInOrder,
  ROTATION_MAX,
  rotationCounts,
  rotationQueue,
  type RotationMode,
} from '@/lib/rotation';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

type Draft = { members: string[]; mode: RotationMode };

/**
 * Rodízio da tarefa (CS2, D381): uma ordem de pessoas do projeto; a vez passa quando alguém conclui
 * (ou na virada da semana), com pular e trocar. A vez e a contagem vêm do servidor.
 */
export function RotationEditor({ task }: { task: Task }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const writable = useCanWrite(task.folder_id);
  const actor = useFolderActor(task.folder_id);
  const members = useTaskMembers(task.folder_id) ?? [];
  const { session } = useSession();
  const me = session?.user.id;
  const enough = members.length >= 2;
  const rotation = useTaskRotation(task.id, online && enough);
  const m = useRotationMutations(task.id);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [swapping, setSwapping] = useState(false);

  const canManage = writable && actorCan(actor, 'task.assign');
  const nameOf = (id: string) =>
    members.find((x) => x.userId === id)?.displayName ?? t('rotation.someone');
  const onError = (err: Error) => toast({ message: t('collab.error', { message: err.message }) });

  if (!enough) return <Text className="text-sm text-ink-muted">{t('rotation.needMembers')}</Text>;
  if (!online) return <Text className="text-sm text-ink-muted">{t('rotation.offline')}</Text>;
  const state = rotation.data ?? null;

  if (draft) {
    const included = new Set(draft.members);
    const save = () =>
      m.set
        .mutateAsync(draft)
        .then(() => {
          setDraft(null);
          toast({ message: t('rotation.saved') });
        })
        .catch(onError);
    return (
      <View className="gap-3">
        <Text className="text-sm text-ink-muted">{t('rotation.pickHint')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {members.map((mem) => (
            <Chip
              key={mem.userId}
              role="checkbox"
              label={mem.displayName}
              selected={included.has(mem.userId)}
              disabled={!included.has(mem.userId) && draft.members.length >= ROTATION_MAX}
              onPress={() =>
                setDraft({
                  ...draft,
                  members: included.has(mem.userId)
                    ? draft.members.filter((id) => id !== mem.userId)
                    : [...draft.members, mem.userId],
                })
              }
            />
          ))}
        </View>
        {draft.members.length > 0 && (
          <View accessibilityLabel={t('rotation.order')}>
            {draft.members.map((id, i) => (
              <View key={id} className="min-h-10 flex-row items-center gap-2 border-b border-line">
                <Text className="w-6 text-sm text-ink-muted">{i + 1}.</Text>
                <Text className="flex-1 text-sm text-ink">{nameOf(id)}</Text>
                <IconButton
                  icon={ChevronUp}
                  label={t('rotation.up', { name: nameOf(id) })}
                  disabled={i === 0}
                  onPress={() => setDraft({ ...draft, members: moveInOrder(draft.members, i, -1) })}
                />
                <IconButton
                  icon={ChevronDown}
                  label={t('rotation.down', { name: nameOf(id) })}
                  disabled={i === draft.members.length - 1}
                  onPress={() => setDraft({ ...draft, members: moveInOrder(draft.members, i, 1) })}
                />
              </View>
            ))}
          </View>
        )}
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {(['turn', 'week'] as const).map((mode) => (
            <Chip
              key={mode}
              role="radio"
              label={t(mode === 'turn' ? 'rotation.modeTurn' : 'rotation.modeWeek')}
              selected={draft.mode === mode}
              onPress={() => setDraft({ ...draft, mode })}
            />
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button
            label={t('rotation.save')}
            disabled={draft.members.length < 2}
            loading={m.set.isPending}
            onPress={save}
          />
          <Button variant="ghost" label={t('rotation.cancel')} onPress={() => setDraft(null)} />
          {state && (
            <Button
              variant="ghost"
              destructive
              label={t('rotation.turnOff')}
              onPress={() =>
                m.set
                  .mutateAsync({ members: [], mode: draft.mode })
                  .then(() => setDraft(null))
                  .catch(onError)
              }
            />
          )}
        </View>
      </View>
    );
  }

  if (!state) {
    if (rotation.isPending) return null;
    return (
      <View className="gap-2">
        <Text className="text-sm text-ink-muted">{t('rotation.hint')}</Text>
        {canManage && (
          <Button
            variant="ghost"
            label={t('rotation.start')}
            className="self-start"
            onPress={() => setDraft({ members: members.map((x) => x.userId), mode: 'turn' })}
          />
        )}
      </View>
    );
  }

  const queue = rotationQueue(state.members, state.current_index);
  const current = queue[0];
  const counts = rotationCounts(state);
  const canPass = canManage || current === me;
  return (
    <View className="gap-2">
      <Text className="text-sm text-ink">
        {t('rotation.now', { name: nameOf(current) })}
        {' · '}
        <Text className="text-sm text-ink-muted">
          {t(state.mode === 'turn' ? 'rotation.modeTurnHint' : 'rotation.modeWeekHint')}
        </Text>
      </Text>
      <View accessibilityLabel={t('rotation.order')}>
        {queue.map((id, i) => {
          const c = counts.find((x) => x.userId === id);
          return (
            <View
              key={id}
              accessibilityLabel={t('rotation.row', {
                name: nameOf(id),
                total: c?.total ?? 0,
                week: c?.week ?? 0,
              })}
              className="min-h-10 flex-row items-center gap-2 border-b border-line"
            >
              <Text className="w-6 text-sm text-ink-muted">{i + 1}.</Text>
              <Text
                className={
                  i === 0 ? 'flex-1 text-sm font-semibold text-ink' : 'flex-1 text-sm text-ink'
                }
              >
                {nameOf(id)}
              </Text>
              <Text className="text-xs text-ink-muted">
                {t('rotation.counts', { total: c?.total ?? 0, week: c?.week ?? 0 })}
              </Text>
            </View>
          );
        })}
      </View>
      {canPass && (
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="ghost"
            label={t('rotation.skip')}
            loading={m.pass.isPending && !swapping}
            onPress={() =>
              m.pass
                .mutateAsync(undefined)
                .then(() => toast({ message: t('rotation.skipped', { name: nameOf(queue[1]) }) }))
                .catch(onError)
            }
          />
          <Button
            variant="ghost"
            label={t('rotation.swap')}
            aria-expanded={swapping}
            onPress={() => setSwapping((v) => !v)}
          />
          {canManage && (
            <Button
              variant="ghost"
              label={t('rotation.edit')}
              onPress={() => setDraft({ members: state.members, mode: state.mode })}
            />
          )}
        </View>
      )}
      {canPass && swapping && (
        <View className="gap-2">
          <Text className="text-sm text-ink-muted">
            {t('rotation.swapHint', { name: nameOf(current) })}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {queue.slice(1).map((id) => (
              <Chip
                key={id}
                label={nameOf(id)}
                onPress={() =>
                  m.pass
                    .mutateAsync(id)
                    .then(() => {
                      setSwapping(false);
                      toast({ message: t('rotation.swapped', { name: nameOf(id) }) });
                    })
                    .catch(onError)
                }
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
