import { router } from 'expo-router';
import { Ellipsis, Pill, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ActionMenu, ConfirmDialog, DialogFrame, PromptDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import {
  medicationBalance,
  parsePills,
  type Medication,
  type MedicationBalance,
} from '@/lib/medications';
import { formatShortDate } from '@/lib/parser/dates';
import { newMedicationId, useMedicationActions, useMedications } from '@/lib/queries/medications';
import { useToday } from '@/lib/queries/profile';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const TIMES = [1, 2, 3, 4, 6] as const;
const EVERY = [
  { days: 1, key: 'wellness.meds.everyDay' },
  { days: 2, key: 'wellness.meds.everyOther' },
  { days: 7, key: 'wellness.meds.weekly' },
] as const;

type Dialog =
  | { kind: 'form'; med?: Medication }
  | { kind: 'bought'; med: Medication }
  | { kind: 'count'; med: Medication }
  | { kind: 'menu'; med: Medication }
  | { kind: 'remove'; med: Medication }
  | { kind: 'revoke' };

/**
 * Remédios do Bem-estar (BE4, D270): quais a pessoa compra, quanto toma e quanto falta para acabar.
 * Remédio é dado de saúde: a seção pede o consentimento específico antes de guardar qualquer coisa.
 */
export function MedicationsSection() {
  const { t } = useTranslation();
  const meds = useMedications();
  const actions = useMedicationActions();
  const online = useIsOnline();
  const toast = useToast();
  const today = useToday();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const fail = (e: Error) => toast({ message: e.message });
  const data = meds.data;

  if (data && !data.consent) {
    return (
      <View className="gap-3">
        <SectionLabel title={t('wellness.meds.title')} />
        <Text className="text-ink">{t('wellness.meds.consentBody')}</Text>
        <Button
          label={t('wellness.meds.consentAccept')}
          className="self-start"
          disabled={!online}
          loading={actions.consent.isPending}
          onPress={() => actions.consent.mutate(true, { onError: fail })}
        />
        {!online && <Text className="text-sm text-ink-muted">{t('body.consentOffline')}</Text>}
        <Button
          variant="ghost"
          className="self-start"
          label={t('body.consentPolicy')}
          onPress={() => router.push('/privacidade')}
        />
      </View>
    );
  }

  const list = data?.list ?? [];
  // Gravar a contagem de hoje: comprar soma ao que resta; contar troca pelo número contado
  const recount = (med: Medication, stock: number) =>
    actions.update.mutate({ id: med.id, fields: { stock, stock_on: today } }, { onError: fail });

  return (
    <View>
      <SectionLabel
        title={t('wellness.meds.title')}
        count={list.length || undefined}
        right={
          <Button
            variant="ghost"
            icon={Plus}
            label={t('wellness.meds.new')}
            onPress={() => setDialog({ kind: 'form' })}
          />
        }
      />
      {data && list.length === 0 && (
        <Text className="px-2 py-3 text-sm text-ink-muted">{t('wellness.meds.empty')}</Text>
      )}
      {list.map((med) => (
        <MedicationRow
          key={med.id}
          med={med}
          balance={medicationBalance(med, today)}
          onBought={() => setDialog({ kind: 'bought', med })}
          onMenu={() => setDialog({ kind: 'menu', med })}
        />
      ))}
      {data && (
        <Button
          variant="ghost"
          className="mt-4 self-start"
          label={t('wellness.meds.revoke')}
          disabled={!online}
          onPress={() => setDialog({ kind: 'revoke' })}
        />
      )}

      {dialog?.kind === 'form' && (
        <MedicationForm
          med={dialog.med}
          onClose={close}
          onSave={(fields) => {
            close();
            if (dialog.med) actions.update.mutate({ id: dialog.med.id, fields }, { onError: fail });
            else
              actions.add.mutate(
                { id: newMedicationId(), ...fields, stock_on: today, paused: false, notes: null },
                { onError: fail },
              );
          }}
        />
      )}
      {dialog?.kind === 'bought' && (
        <PromptDialog
          title={t('wellness.meds.boughtTitle', { name: dialog.med.name })}
          message={t('wellness.meds.boughtHint')}
          fields={[
            {
              key: 'n',
              placeholder: t('wellness.meds.pills'),
              initial: dialog.med.pack_size ? String(dialog.med.pack_size) : '',
            },
          ]}
          confirmLabel={t('wellness.meds.add')}
          validate={(v) => (parsePills(v.n) ?? 0) > 0}
          onClose={close}
          onConfirm={(v) => {
            const { med } = dialog;
            close();
            recount(med, medicationBalance(med, today).left + (parsePills(v.n) ?? 0));
            toast({ message: t('wellness.meds.boughtToast', { name: med.name }) });
          }}
        />
      )}
      {dialog?.kind === 'count' && (
        <PromptDialog
          title={t('wellness.meds.countTitle', { name: dialog.med.name })}
          message={t('wellness.meds.countHint')}
          fields={[
            {
              key: 'n',
              placeholder: t('wellness.meds.pills'),
              initial: formatPills(medicationBalance(dialog.med, today).left),
            },
          ]}
          validate={(v) => parsePills(v.n) != null}
          onClose={close}
          onConfirm={(v) => {
            const { med } = dialog;
            close();
            recount(med, parsePills(v.n) ?? 0);
          }}
        />
      )}
      {dialog?.kind === 'menu' && (
        <ActionMenu
          title={dialog.med.name}
          onClose={close}
          actions={[
            {
              label: t('common.edit'),
              onPress: () => setDialog({ kind: 'form', med: dialog.med }),
            },
            {
              label: t('wellness.meds.count'),
              onPress: () => setDialog({ kind: 'count', med: dialog.med }),
            },
            {
              label: t(dialog.med.paused ? 'wellness.meds.resume' : 'wellness.meds.pause'),
              onPress: () => {
                const { med } = dialog;
                // Parar grava o que sobrou; voltar recomeça a contar de hoje
                const left = medicationBalance(med, today).left;
                actions.update.mutate(
                  {
                    id: med.id,
                    fields: med.paused
                      ? { paused: false, stock_on: today }
                      : { paused: true, stock: left, stock_on: today },
                  },
                  { onError: fail },
                );
              },
            },
            {
              label: t('common.delete'),
              destructive: true,
              onPress: () => setDialog({ kind: 'remove', med: dialog.med }),
            },
          ]}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmDialog
          destructive
          title={t('wellness.meds.removeTitle', { name: dialog.med.name })}
          confirmLabel={t('common.delete')}
          onClose={close}
          onConfirm={() => {
            const { med } = dialog;
            close();
            actions.remove.mutate(med.id, { onError: fail });
          }}
        />
      )}
      {dialog?.kind === 'revoke' && (
        <ConfirmDialog
          destructive
          title={t('wellness.meds.revokeTitle')}
          message={t('wellness.meds.revokeBody')}
          confirmLabel={t('body.revokeConfirm')}
          onClose={close}
          onConfirm={() => {
            close();
            actions.consent.mutate(false, { onError: fail });
          }}
        />
      )}
    </View>
  );
}

function formatPills(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

/** "1 comprimido · 2× por dia", "½ comprimido · dia sim, dia não" */
function useScheduleLabel() {
  const { t } = useTranslation();
  return (med: Pick<Medication, 'dose' | 'times_per_day' | 'every_days'>) => {
    const dose =
      med.dose === 0.5
        ? t('wellness.meds.half')
        : t('wellness.meds.dose', { count: med.dose, n: formatPills(med.dose) });
    const every = EVERY.find((e) => e.days === med.every_days);
    const when = every ? t(every.key) : t('wellness.meds.everyN', { count: med.every_days });
    return med.times_per_day > 1
      ? `${dose} · ${t('wellness.meds.timesPerDay', { count: med.times_per_day })} · ${when}`
      : `${dose} · ${when}`;
  };
}

function MedicationRow({
  med,
  balance,
  onBought,
  onMenu,
}: {
  med: Medication;
  balance: MedicationBalance;
  onBought: () => void;
  onMenu: () => void;
}) {
  const { t } = useTranslation();
  const schedule = useScheduleLabel();
  const left = t('wellness.meds.left', { count: balance.left, n: formatPills(balance.left) });
  const status =
    balance.state === 'paused'
      ? `${t('wellness.meds.paused')} · ${left}`
      : balance.state === 'out'
        ? t('wellness.meds.out')
        : `${left} · ${
            balance.daysLeft === 0
              ? t('wellness.meds.endsToday')
              : t('wellness.meds.until', {
                  date: formatShortDate(balance.lastDay ?? ''),
                  count: balance.daysLeft ?? 0,
                })
          }`;
  return (
    <View
      className="min-h-14 flex-row items-center gap-3 border-b border-line px-2 py-2"
      accessibilityLabel={`${med.name}: ${status}`}
    >
      <Icon icon={Pill} tone="ink-muted" />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{med.name}</Text>
        <Text className="text-xs text-ink-muted">{schedule(med)}</Text>
        <Text
          className={cn(
            'text-xs',
            balance.state === 'out'
              ? 'text-danger'
              : balance.state === 'low'
                ? 'font-semibold text-warn'
                : 'text-ink-muted',
          )}
        >
          {status}
          {balance.state === 'low' && ` · ${t('wellness.meds.buySoon')}`}
        </Text>
      </View>
      <Button
        variant="ghost"
        icon={ShoppingCart}
        label={t('wellness.meds.bought')}
        accessibilityLabel={t('wellness.meds.boughtTitle', { name: med.name })}
        onPress={onBought}
      />
      <IconButton
        icon={Ellipsis}
        label={t('wellness.meds.options', { name: med.name })}
        onPress={onMenu}
      />
    </View>
  );
}

type FormFields = Pick<
  Medication,
  'name' | 'dose' | 'times_per_day' | 'every_days' | 'pack_size' | 'stock'
>;

/** Novo remédio ou editar: nome, quanto toma, a caixa e quantos tem agora. */
function MedicationForm({
  med,
  onSave,
  onClose,
}: {
  med?: Medication;
  onSave: (fields: FormFields) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const [name, setName] = useState(med?.name ?? '');
  const [dose, setDose] = useState(med ? formatPills(med.dose) : '1');
  const [times, setTimes] = useState(med?.times_per_day ?? 1);
  const [every, setEvery] = useState(med?.every_days ?? 1);
  const [pack, setPack] = useState(med?.pack_size ? String(med.pack_size) : '');
  const [stock, setStock] = useState(med ? formatPills(medicationBalance(med, today).left) : '');
  const doseValue = parsePills(dose);
  const stockValue = parsePills(stock || pack);
  const packValue = pack ? parsePills(pack) : null;
  const valid =
    name.trim().length > 0 &&
    doseValue != null &&
    doseValue > 0 &&
    stockValue != null &&
    (!pack || (packValue != null && Number.isInteger(packValue) && packValue > 0));

  function save() {
    if (!valid || doseValue == null || stockValue == null) return;
    const fields: FormFields = {
      name: name.trim(),
      dose: doseValue,
      times_per_day: times,
      every_days: every,
      pack_size: packValue,
      stock: stockValue,
    };
    // Editar sem mexer no "tenho agora" não regrava a contagem (mantém a data dela)
    const counted = !med || stockValue !== medicationBalance(med, today).left;
    onSave(counted || !med ? { ...fields } : { ...fields, stock: med.stock });
  }

  return (
    <DialogFrame wide onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">
        {med ? t('wellness.meds.editTitle') : t('wellness.meds.new')}
      </Text>
      <Input
        placeholder={t('wellness.meds.name')}
        accessibilityLabel={t('wellness.meds.name')}
        value={name}
        maxLength={120}
        autoFocus={!med}
        onChangeText={setName}
      />
      <View className="gap-1">
        <Text className="text-sm text-ink">{t('wellness.meds.dosePerTime')}</Text>
        <Input
          accessibilityLabel={t('wellness.meds.dosePerTime')}
          keyboardType="decimal-pad"
          value={dose}
          onChangeText={setDose}
        />
      </View>
      <View className="gap-1">
        <Text className="text-sm text-ink">{t('wellness.meds.howOften')}</Text>
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('wellness.meds.howOften')}
        >
          {TIMES.map((n) => (
            <Chip
              key={n}
              role="radio"
              label={t('wellness.meds.timesPerDay', { count: n })}
              selected={times === n}
              onPress={() => setTimes(n)}
            />
          ))}
        </View>
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('wellness.meds.whichDays')}
        >
          {EVERY.map((e) => (
            <Chip
              key={e.days}
              role="radio"
              label={t(e.key)}
              selected={every === e.days}
              onPress={() => setEvery(e.days)}
            />
          ))}
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-sm text-ink">{t('wellness.meds.packSize')}</Text>
          <Input
            accessibilityLabel={t('wellness.meds.packSize')}
            keyboardType="number-pad"
            value={pack}
            placeholder="30"
            onChangeText={setPack}
          />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm text-ink">{t('wellness.meds.haveNow')}</Text>
          <Input
            accessibilityLabel={t('wellness.meds.haveNow')}
            keyboardType="decimal-pad"
            value={stock}
            placeholder={pack || '0'}
            onChangeText={setStock}
            onSubmitEditing={save}
          />
        </View>
      </View>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} disabled={!valid} onPress={save} />
      </View>
    </DialogFrame>
  );
}
