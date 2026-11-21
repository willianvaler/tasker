import { useMutation } from '@tanstack/react-query';
import { CalendarSearch } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { SlotPicker } from '@/components/agenda/public';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatDuration, groupSlots, localParts } from '@/lib/booking';
import { parseQuickInput } from '@/lib/parser/quick';
import { fetchGroupSlots, type GroupSlots } from '@/lib/queries/booking';
import { useTimeZone, useToday } from '@/lib/queries/profile';
import { useCreateTasks, useUpdateTask } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { uuidv7 } from '@/lib/uuid';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';
import { useToast } from '@/providers/toast';

const DURATIONS = [30, 60, 90];
const DAYS = [7, 14];

export type FindTimePerson = { userId: string; displayName: string };

/**
 * "Achar horário" (AG3, D312): escolhe as pessoas do grupo e a duração e mostra os horários em
 * que todas estão livres (a conta é do servidor; cada um vê só livre/ocupado dos outros).
 * Escolher um horário cria a tarefa: no projeto, com as pessoas como responsáveis; num time ou
 * clã (sem lista em comum), na minha Caixa de entrada.
 */
export function FindTimeButton({
  people,
  pages,
}: {
  people: FindTimePerson[];
  /** Listas do projeto onde o compromisso pode entrar (sem elas, vai para a Caixa de entrada) */
  pages?: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        icon={CalendarSearch}
        className="self-start"
        label={t('findTime.open')}
        disabled={!online || people.length < 2}
        onPress={() => setOpen(true)}
      />
      {open && <FindTimeDialog people={people} pages={pages} onClose={() => setOpen(false)} />}
    </>
  );
}

function FindTimeDialog({
  people,
  pages,
  onClose,
}: {
  people: FindTimePerson[];
  pages?: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useSession();
  const me = session?.user.id;
  const timeZone = useTimeZone();
  const today = useToday();
  const tree = useTree();
  const create = useCreateTasks();
  const update = useUpdateTask();
  const others = people.filter((p) => p.userId !== me);
  const [chosen, setChosen] = useState<string[]>(others.map((p) => p.userId));
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<GroupSlots | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [title, setTitle] = useState(t('findTime.defaultTitle'));
  const [pageId, setPageId] = useState(pages?.[0]?.id ?? null);

  const search = useMutation({
    mutationFn: () => fetchGroupSlots(chosen, duration, days),
    onSuccess: (data) => {
      setResult(data);
      setDay(null);
      setSlot(null);
    },
  });
  const reset = () => setResult(null);
  const toggle = (id: string) => {
    reset();
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const nameOf = (id: string) =>
    id === me ? t('findTime.you') : (people.find((p) => p.userId === id)?.displayName ?? '?');
  const target = pages?.length ? pageId : (tree.data?.inbox?.id ?? null);

  async function schedule() {
    if (!slot || !target || !title.trim()) return;
    const { date, time } = localParts(slot, timeZone);
    const id = uuidv7();
    const parsed = parseQuickInput(title.trim(), { today });
    await create.mutateAsync({
      pageId: target,
      items: [
        {
          ...parsed,
          title: parsed.title || title.trim(),
          id,
          dueDate: date,
          dueTime: time,
          remindBefore: 15,
          // No projeto, quem vai participar fica como responsável (eu incluído)
          assignees: pages?.length
            ? [...new Set([...(me ? [me] : []), ...chosen])].map((userId) => ({ user_id: userId }))
            : [],
        },
      ],
    });
    // A duração conta como ocupado nas próximas buscas (sem ela, 30 min)
    update.mutate({ id, patch: { estimate_minutes: duration } });
    toast({ message: t('findTime.created') });
    onClose();
  }

  const groups = result ? groupSlots(result.slots, timeZone) : [];
  const noAgenda = result?.no_agenda ?? [];

  return (
    <DialogFrame onClose={onClose} wide>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {t('findTime.title')}
      </Text>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <Text className="text-sm text-ink-muted">{t('findTime.hint')}</Text>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('findTime.people')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {others.map((p) => (
                <Chip
                  key={p.userId}
                  role="checkbox"
                  label={p.displayName}
                  selected={chosen.includes(p.userId)}
                  onPress={() => toggle(p.userId)}
                />
              ))}
            </View>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('findTime.duration')}</Text>
            <View role="radiogroup" aria-label={t('findTime.duration')} className="flex-row gap-2">
              {DURATIONS.map((d) => (
                <Chip
                  key={d}
                  role="radio"
                  label={formatDuration(d)}
                  selected={duration === d}
                  onPress={() => {
                    reset();
                    setDuration(d);
                  }}
                />
              ))}
            </View>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('findTime.days')}</Text>
            <View role="radiogroup" aria-label={t('findTime.days')} className="flex-row gap-2">
              {DAYS.map((d) => (
                <Chip
                  key={d}
                  role="radio"
                  label={t('findTime.nextDays', { n: d })}
                  selected={days === d}
                  onPress={() => {
                    reset();
                    setDays(d);
                  }}
                />
              ))}
            </View>
          </View>
          <Button
            className="self-start"
            label={t('findTime.search')}
            disabled={chosen.length === 0}
            loading={search.isPending}
            onPress={() => search.mutate()}
          />
          {search.error && (
            <Text accessibilityRole="alert" className="text-sm text-danger">
              {t('findTime.error', { message: search.error.message })}
            </Text>
          )}

          {result && (
            <View className="gap-3 border-t border-line pt-4">
              {noAgenda.length > 0 && (
                <Text className="text-sm text-ink-muted">
                  {t('findTime.noAgenda', { names: noAgenda.map(nameOf).join(', ') })}
                </Text>
              )}
              {groups.length === 0 ? (
                <Text className="text-ink">{t('findTime.none')}</Text>
              ) : (
                <SlotPicker
                  days={groups}
                  day={day}
                  slot={slot}
                  onDay={(d) => {
                    setDay(d);
                    setSlot(null);
                  }}
                  onSlot={setSlot}
                />
              )}
            </View>
          )}

          {slot && (
            <View className="gap-3 border-t border-line pt-4">
              <Input
                value={title}
                onChangeText={setTitle}
                maxLength={200}
                accessibilityLabel={t('findTime.taskTitle')}
                placeholder={t('findTime.taskTitle')}
              />
              {pages && pages.length > 1 && (
                <View className="gap-1">
                  <Text className="text-sm font-semibold text-ink">{t('findTime.list')}</Text>
                  <View
                    role="radiogroup"
                    aria-label={t('findTime.list')}
                    className="flex-row flex-wrap gap-2"
                  >
                    {pages.map((p) => (
                      <Chip
                        key={p.id}
                        role="radio"
                        label={p.name}
                        selected={pageId === p.id}
                        onPress={() => setPageId(p.id)}
                      />
                    ))}
                  </View>
                </View>
              )}
              <Text className="text-sm text-ink-muted">
                {pages?.length ? t('findTime.projectNote') : t('findTime.inboxNote')}
              </Text>
              <Button
                className="self-start"
                label={t('findTime.create')}
                disabled={!title.trim() || !target}
                loading={create.isPending}
                onPress={() =>
                  void schedule().catch((e: Error) =>
                    toast({ message: t('findTime.error', { message: e.message }) }),
                  )
                }
              />
            </View>
          )}
        </View>
      </ScrollView>
    </DialogFrame>
  );
}
