import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { CalendarPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { deviceTimeZone, PublicShell, useWhen } from '@/components/agenda/public';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bookingIcs, formatDuration } from '@/lib/booking';
import { saveTextFile } from '@/lib/download';
import { fetchPublicPoll, votePoll, type PollResult } from '@/lib/queries/time-poll';
import { webUrl } from '@/lib/queries/projects';
import { localStore } from '@/lib/storage';

/** Quem responde, guardado neste navegador para poder mudar o voto (sem conta) */
function voterId(token: string): string {
  const key = `questlist:poll-voter:${token}`;
  try {
    const saved = localStore?.getItem(key);
    if (saved && saved.length >= 16) return saved;
    const id = randomUUID();
    localStore?.setItem(key, id);
    return id;
  } catch {
    return randomUUID();
  }
}

/**
 * Enquete de horário aberta pelo link (AG4, D319), FORA do login: cada pessoa põe o nome (o e-mail
 * é opcional, só a dona vê) e marca os horários que servem, no fuso de quem abre. Fechada, mostra
 * o horário escolhido com o .ics.
 */
export default function PollVoteScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const when = useWhen();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [voter] = useState(() => voterId(token));
  const key = ['time-poll-public', token];
  const poll = useQuery({
    queryKey: key,
    queryFn: () => fetchPublicPoll(token, voter),
    retry: false,
  });
  const [draft, setDraft] = useState<{ name: string; email: string; slots: string[] } | null>(null);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (poll.isPending)
    return (
      <PublicShell title="Questlist">
        <Text className="text-ink-muted">{t('booking.loading')}</Text>
      </PublicShell>
    );
  const data = poll.data;
  if (!data || data.status !== 'ok')
    return (
      <PublicShell title="Questlist">
        <Text className="font-serif text-xl text-ink">
          {poll.error ? t('booking.error') : t('poll.missing')}
        </Text>
      </PublicShell>
    );
  const p = data.poll;
  const form = draft ?? {
    name: p.mine?.name ?? '',
    email: p.mine?.email ?? '',
    slots: p.mine?.slots ?? [],
  };
  const set = (patch: Partial<typeof form>) => setDraft({ ...form, ...patch });
  const toggle = (id: string, on: boolean) =>
    set({ slots: on ? [...form.slots, id] : form.slots.filter((x) => x !== id) });

  async function send() {
    if (!form.name.trim()) return;
    setProblem(null);
    setSending(true);
    try {
      const result: PollResult = await votePoll({
        token,
        voter,
        name: form.name.trim(),
        email: form.email.trim(),
        slots: form.slots,
      });
      if (result.status === 'ok') {
        queryClient.setQueryData(key, result);
        setDraft(null);
        setSent(true);
      } else setProblem(t(`poll.problem.${result.status}`));
    } catch (e) {
      setProblem(t('booking.sendError', { message: (e as Error).message }));
    } finally {
      setSending(false);
    }
  }

  const chosen = p.state === 'closed' ? p.chosen : null;
  return (
    <PublicShell title={p.title}>
      <View className="gap-1">
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">
          {p.title}
        </Text>
        <Text className="text-ink">
          {t('poll.from', { name: p.owner })} · {formatDuration(p.duration_min)}
        </Text>
        {p.note && <Text className="text-ink-muted">{p.note}</Text>}
        <Text className="text-sm text-ink-muted">
          {t('booking.inYourZone', { zone: deviceTimeZone() })}
        </Text>
      </View>

      {p.state === 'closed' ? (
        <View className="gap-3">
          <Text className="text-lg text-ink">
            {chosen ? t('poll.decided', { when: when(chosen) }) : t('poll.closed')}
          </Text>
          {chosen && (
            <Button
              variant="ghost"
              icon={CalendarPlus}
              className="self-start"
              label={t('booking.addToCalendar')}
              onPress={() =>
                saveTextFile(
                  'compromisso.ics',
                  bookingIcs({
                    uid: `poll-${token}`,
                    starts_at: chosen,
                    ends_at: new Date(Date.parse(chosen) + p.duration_min * 60_000).toISOString(),
                    title: `${p.title} · ${p.owner}`,
                    url: webUrl(`/horario/${token}`),
                  }),
                  'text/calendar',
                )
              }
            />
          )}
        </View>
      ) : (
        <View className="gap-4">
          <Text className="text-ink">{t('poll.pick')}</Text>
          <View accessibilityRole="list">
            {p.slots.map((slot) => {
              const mine = form.slots.includes(slot.id);
              return (
                <View key={slot.id} className="gap-1 border-b border-line py-2">
                  <View className="flex-row items-center gap-2">
                    <Checkbox
                      checked={mine}
                      label={when(slot.starts_at)}
                      onChange={(checked) => toggle(slot.id, checked)}
                    />
                    <Pressable
                      className="flex-1"
                      onPress={() => toggle(slot.id, !mine)}
                      importantForAccessibility="no"
                    >
                      <Text className="text-ink">{when(slot.starts_at)}</Text>
                    </Pressable>
                  </View>
                  {slot.names.length > 0 && (
                    <Text className="pl-12 text-xs text-ink-muted">
                      {t('poll.whoCan', { count: slot.names.length, names: slot.names.join(', ') })}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <Input
            value={form.name}
            onChangeText={(name) => set({ name })}
            maxLength={80}
            autoComplete="name"
            placeholder={t('booking.name')}
            accessibilityLabel={t('booking.name')}
          />
          <Input
            value={form.email}
            onChangeText={(email) => set({ email })}
            maxLength={254}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder={t('poll.emailOptional')}
            accessibilityLabel={t('poll.emailOptional')}
          />
          <Text className="text-xs text-ink-muted">{t('poll.privacy', { name: p.owner })}</Text>
          <Button
            className="self-start"
            label={p.mine ? t('poll.update') : t('poll.send')}
            disabled={!form.name.trim() || sending}
            onPress={send}
          />
          {sent && (
            <Text accessibilityRole="alert" className="text-sm text-ink">
              {t('poll.sent')}
            </Text>
          )}
          {problem && (
            <Text accessibilityRole="alert" className="text-sm text-danger">
              {problem}
            </Text>
          )}
        </View>
      )}
    </PublicShell>
  );
}
