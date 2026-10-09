import { useState } from 'react';
import { Text, View } from 'react-native';

import { BossBoard } from '@/components/boss-board';
import { BossLine } from '@/components/game-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog, useDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { addDays, formatShortDate, nextWeekday } from '@/lib/parser/dates';
import { parseQuickInput } from '@/lib/parser/quick';
import { useProjectBoss, useProjectBossMutations } from '@/lib/queries/clan';
import { useGameState } from '@/lib/queries/game';
import { useToday } from '@/lib/queries/profile';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

/**
 * Boss de projeto com prazo (ESCOPO 4.6): "o churrasco é sábado: derrote o boss até lá".
 * HP = tarefas principais do projeto; cada uma concluída é 1 de dano.
 */
export function ProjectBoss({ rootId }: { rootId: string }) {
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
      onError: (err) => toast({ message: `Não deu certo: ${err.message}` }),
    });
  }

  const typed = dateText.trim() ? parseQuickInput(`x ${dateText}`, { today }).dueDate : null;

  return (
    <View className="gap-2 rounded-xl border border-border bg-card p-3">
      <Text className="font-semibold text-foreground">Boss do projeto</Text>
      {current ? (
        <>
          <BossLine boss={current} />
          <BossBoard bossId={current.id} unit={['tarefa', 'tarefas']} />
          {writable && current.status === 'active' && (
            <Button
              variant="ghost"
              className="self-start"
              label="Desistir do boss"
              onPress={() => setConfirmCancel(true)}
            />
          )}
        </>
      ) : choosing ? (
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">
            Até quando a galera tem para concluir tudo?
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={`Sábado (${formatShortDate(nextWeekday(today, 6))})`}
              onPress={() => start(nextWeekday(today, 6))}
            />
            <Chip label="Em 1 semana" onPress={() => start(addDays(today, 7))} />
            <Chip label="Em 1 mês" onPress={() => start(addDays(today, 30))} />
          </View>
          <Input
            value={dateText}
            onChangeText={setDateText}
            onSubmitEditing={() => typed && start(typed)}
            submitBehavior="submit"
            placeholder="Outra data: 15/10, sexta…"
            accessibilityLabel="Prazo do boss"
          />
          {typed && (
            <Button label={`Prazo: ${formatShortDate(typed)}`} onPress={() => start(typed)} />
          )}
          <Button
            variant="ghost"
            className="self-start"
            label="Cancelar"
            onPress={() => setChoosing(false)}
          />
        </View>
      ) : (
        <>
          <Text className="text-sm text-muted-foreground">
            {boss.data?.status === 'defeated'
              ? `${boss.data.icon} ${boss.data.name} foi derrotado. Quer outro desafio?`
              : 'Chame um boss com prazo: cada tarefa concluída é um golpe, e todo mundo que ajudou ganha a recompensa.'}
          </Text>
          {writable && (
            <Button
              variant="outline"
              className="self-start"
              label="⚔️ Chamar boss com prazo"
              loading={m.start.isPending}
              onPress={() => setChoosing(true)}
            />
          )}
        </>
      )}
      {confirmCancel && (
        <ConfirmDialog
          title="Desistir do boss?"
          message="Ele foge sem punição. Dá para chamar outro depois."
          confirmLabel="Desistir"
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
