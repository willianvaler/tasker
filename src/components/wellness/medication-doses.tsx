import { Undo2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { DialogFrame } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  dosesOfDay,
  intakeFor,
  SNOOZE_MAX,
  type Dose,
  type Intake,
  type Medication,
} from '@/lib/medications';
import { formatShortDate } from '@/lib/parser/dates';
import { useMedicationActions } from '@/lib/queries/medications';
import { useTimeZone } from '@/lib/queries/profile';
import { useToast } from '@/providers/toast';

/** Hora de agora (minutos do dia) no fuso do perfil. */
function nowMinutesIn(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/**
 * Doses de hoje (SA3, D385): por horário, com Tomei, Pular e Adiar (até 3 vezes, 15 min cada). O
 * que já foi respondido mostra o estado e Desfazer. Grava sem conexão.
 */
export function DosesToday({
  meds,
  intakes,
  today,
}: {
  meds: Medication[];
  intakes: Intake[];
  today: string;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useTimeZone();
  const actions = useMedicationActions();
  const toast = useToast();
  const doses = dosesOfDay(meds, intakes, today, nowMinutesIn(timeZone));
  if (doses.length === 0) return null;
  const fail = (e: Error) => toast({ message: e.message });

  const answer = (dose: Dose, action: 'taken' | 'skipped' | 'snoozed') => {
    const intake = intakeFor(dose.medication.id, today, dose.slot, action, dose.intake, new Date());
    if (!intake) return;
    actions.record.mutate(intake, { onError: fail });
  };
  const until = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(i18n.language, {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  return (
    <View className="mb-4 gap-1" accessibilityLabel={t('wellness.meds.today')}>
      <Text className="text-sm font-semibold text-ink">{t('wellness.meds.today')}</Text>
      {doses.map((dose) => {
        const label = `${dose.slot} · ${dose.medication.name}`;
        const answered = dose.state === 'taken' || dose.state === 'skipped';
        const status =
          dose.state === 'taken'
            ? t('wellness.meds.stateTaken')
            : dose.state === 'skipped'
              ? t('wellness.meds.stateSkipped')
              : dose.state === 'snoozed'
                ? t('wellness.meds.stateSnoozed', {
                    time: until(dose.intake?.snoozed_until ?? null),
                    count: dose.intake?.snoozes ?? 0,
                  })
                : dose.state === 'due'
                  ? t('wellness.meds.stateDue')
                  : t('wellness.meds.stateLater');
        const canSnooze = (dose.intake?.snoozes ?? 0) < SNOOZE_MAX;
        return (
          <View
            key={`${dose.medication.id}|${dose.slot}`}
            className="min-h-12 flex-row flex-wrap items-center gap-2 border-b border-line py-1"
            accessibilityLabel={`${label}: ${status}`}
          >
            <View className="min-w-40 flex-1">
              <Text className={cn('text-sm text-ink', answered && 'text-ink-muted')}>{label}</Text>
              <Text
                className={cn(
                  'text-xs',
                  dose.state === 'due' ? 'font-semibold text-warn' : 'text-ink-muted',
                )}
              >
                {status}
              </Text>
            </View>
            {answered ? (
              <IconButton
                icon={Undo2}
                label={t('wellness.meds.undoDose', { dose: label })}
                onPress={() =>
                  dose.intake && actions.undo.mutate(dose.intake.id, { onError: fail })
                }
              />
            ) : (
              <View className="flex-row flex-wrap gap-1">
                <Button
                  label={t('wellness.meds.taken')}
                  accessibilityLabel={t('wellness.meds.takenDose', { dose: label })}
                  onPress={() => answer(dose, 'taken')}
                />
                <Button
                  variant="ghost"
                  label={t('wellness.meds.skip')}
                  accessibilityLabel={t('wellness.meds.skipDose', { dose: label })}
                  onPress={() => answer(dose, 'skipped')}
                />
                {dose.state !== 'later' && (
                  <Button
                    variant="ghost"
                    label={t('wellness.meds.snooze')}
                    accessibilityLabel={t('wellness.meds.snoozeDose', { dose: label })}
                    disabled={!canSnooze}
                    onPress={() => answer(dose, 'snoozed')}
                  />
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Histórico de um remédio: as doses respondidas nos últimos 30 dias, da mais nova. */
export function MedicationHistory({
  med,
  intakes,
  onClose,
}: {
  med: Medication;
  intakes: Intake[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rows = intakes
    .filter((i) => i.medication_id === med.id)
    .sort((a, b) => b.day.localeCompare(a.day) || b.slot.localeCompare(a.slot));
  const word = (i: Intake) =>
    i.status === 'taken'
      ? t('wellness.meds.stateTaken')
      : i.status === 'skipped'
        ? t('wellness.meds.stateSkipped')
        : t('wellness.meds.historySnoozed', { count: i.snoozes });
  return (
    <DialogFrame wide onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">
        {t('wellness.meds.historyTitle', { name: med.name })}
      </Text>
      {rows.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('wellness.meds.historyEmpty')}</Text>
      ) : (
        <View accessibilityLabel={t('wellness.meds.historyTitle', { name: med.name })}>
          {rows.map((i) => (
            <View key={i.id} className="min-h-9 flex-row items-center gap-3 border-b border-line">
              <Text className="w-24 text-sm text-ink-muted">
                {formatShortDate(i.day)} {i.slot}
              </Text>
              <Text className="flex-1 text-sm text-ink">
                {word(i)}
                {i.status !== 'snoozed' && i.snoozes > 0
                  ? ` · ${t('wellness.meds.historySnoozed', { count: i.snoozes })}`
                  : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row justify-end">
        <Button variant="ghost" label={t('common.close')} onPress={onClose} />
      </View>
    </DialogFrame>
  );
}
