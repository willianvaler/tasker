import { Swords } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BossBoard } from '@/components/boss-board';
import { BossLine } from '@/components/game-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { addDays, formatShortDate, nextWeekday } from '@/lib/parser/dates';
import { parseQuickInput } from '@/lib/parser/quick';
import { useProjectBoss, useProjectBossMutations } from '@/lib/queries/clan';
import { useGameState } from '@/lib/queries/game';
import { useToday } from '@/lib/queries/profile';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/**
 * Boss de projeto com prazo: "o churrasco é sábado: derrote o boss até lá".
 * HP = tarefas principais do projeto; cada uma concluída é 1 de dano.
 */
export function ProjectBoss({ rootId }: { rootId: string }) {
  const { t } = useTranslation();
  const boss = useProjectBoss(rootId);
  const game = useGameState();
  const m = useProjectBossMutations(rootId);
  const writable = useCanWrite(rootId);
  const today = useToday();
  const toast = useToast();
  const [choosing, setChoosing] = useState(false);
  const [dateText, setDateText] = useState('');
  const [confirmCancel, setConfirmCancel, closeCancel] = useDialog<true>();

  if (game.data?.enabled === false) return null;
  const current =
    boss.data && boss.data.status !== 'escaped' && new Date(boss.data.ends_at) > new Date()
      ? boss.data
      : null;

  function start(deadline: string) {
    setChoosing(false);
    setDateText('');
    m.start.mutate(deadline, {
      onError: (err) => toast({ message: t('clan.error', { message: err.message }) }),
    });
  }

  const typed = dateText.trim() ? parseQuickInput(`x ${dateText}`, { today }).dueDate : null;

  return (
    <View className="gap-3">
      <SectionLabel title={t('projectBoss.title')} className="pt-0" />
      {current ? (
        <>
          <BossLine boss={current} />
          <BossBoard bossId={current.id} unit="tasks" />
          {writable && current.status === 'active' && (
            <Button
              variant="ghost"
              className="self-start"
              label={t('projectBoss.giveUp')}
              onPress={() => setConfirmCancel(true)}
            />
          )}
        </>
      ) : choosing ? (
        <View className="gap-2">
          <Text className="text-sm text-ink-muted">{t('projectBoss.until')}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('projectBoss.saturday', { date: formatShortDate(nextWeekday(today, 6)) })}
              onPress={() => start(nextWeekday(today, 6))}
            />
            <Chip label={t('projectBoss.week')} onPress={() => start(addDays(today, 7))} />
            <Chip label={t('projectBoss.month')} onPress={() => start(addDays(today, 30))} />
          </View>
          <Input
            value={dateText}
            onChangeText={setDateText}
            onSubmitEditing={() => typed && start(typed)}
            submitBehavior="submit"
            placeholder={t('projectBoss.otherDate')}
            accessibilityLabel={t('projectBoss.deadline')}
          />
          {typed && (
            <Button
              label={t('projectBoss.deadlineButton', { date: formatShortDate(typed) })}
              onPress={() => start(typed)}
            />
          )}
          <Button
            variant="ghost"
            className="self-start"
            label={t('common.cancel')}
            onPress={() => setChoosing(false)}
          />
        </View>
      ) : (
        <>
          <Text className="text-sm text-ink-muted">
            {boss.data?.status === 'defeated'
              ? t('projectBoss.defeated', { name: boss.data.name })
              : t('projectBoss.intro')}
          </Text>
          {writable && (
            <Button
              variant="ghost"
              className="self-start"
              icon={Swords}
              label={t('projectBoss.call')}
              loading={m.start.isPending}
              onPress={() => setChoosing(true)}
            />
          )}
        </>
      )}
      {confirmCancel && (
        <ConfirmDialog
          title={t('projectBoss.giveUpTitle')}
          message={t('projectBoss.giveUpMessage')}
          confirmLabel={t('projectBoss.giveUpConfirm')}
          onClose={closeCancel}
          onConfirm={() => {
            closeCancel();
            m.cancel.mutate();
          }}
        />
      )}
    </View>
  );
}
