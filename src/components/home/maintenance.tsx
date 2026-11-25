import { Ellipsis, Plus, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ActionMenu, ConfirmDialog, DialogFrame } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { contextMenu } from '@/lib/context-menu';
import {
  formatDayInput,
  parseDay,
  parsePastDay,
  planNext,
  planStatus,
  sortPlans,
  warrantyState,
  type Equipment,
  type MaintenancePlan,
  type MaintenanceUnit,
} from '@/lib/maintenance';
import { formatDueDate, formatShortDate } from '@/lib/parser/dates';
import { formatMoney } from '@/lib/expenses';
import {
  newHomeId,
  useHome,
  useHomeActions,
  useMyExpenses,
  type ExpenseOption,
} from '@/lib/queries/equipments';
import { useToday } from '@/lib/queries/profile';
import { useToggleTask } from '@/lib/queries/tasks';
import { useToast } from '@/providers/toast';
import { useQueryClient } from '@tanstack/react-query';

type Dialog =
  | { kind: 'equipment'; equipment?: Equipment }
  | { kind: 'plan'; equipment: Equipment; plan?: MaintenancePlan }
  | { kind: 'menuEquipment'; equipment: Equipment }
  | { kind: 'menuPlan'; plan: MaintenancePlan }
  | { kind: 'removeEquipment'; equipment: Equipment }
  | { kind: 'removePlan'; plan: MaintenancePlan };

/**
 * Casa (CS1, D365): os equipamentos e o que fazer em cada um. Cada plano mantém uma tarefa aberta
 * (na Caixa de entrada, com a etiqueta #manutencao); concluir a tarefa, aqui ou na lista, conta o
 * "último feito" e agenda a próxima a partir desse dia.
 */
export function HomeMaintenance() {
  const { t } = useTranslation();
  const home = useHome();
  const actions = useHomeActions();
  const toggle = useToggleTask();
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = useToday();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const fail = (e: Error) => toast({ message: e.message });
  const equipments = home.data?.equipments ?? [];
  const plans = home.data?.plans ?? [];
  const nameOf = (id: string) => equipments.find((e) => e.id === id)?.name ?? '';

  function done(plan: MaintenancePlan) {
    if (!plan.task_id) return;
    toggle
      .mutateAsync({ id: plan.task_id, done: true })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['equipments'] });
        toast({ message: t('casa.doneToast', { name: plan.name }) });
      })
      .catch(fail);
  }

  return (
    <View className="gap-8">
      <View>
        <SectionLabel title={t('casa.upcoming')} count={plans.length || undefined} />
        {home.data && plans.length === 0 && (
          <Text className="px-2 py-3 text-sm text-ink-muted">{t('casa.noPlans')}</Text>
        )}
        {sortPlans(plans, today).map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            equipment={nameOf(plan.equipment_id)}
            today={today}
            onDone={() => done(plan)}
            onMenu={() => setDialog({ kind: 'menuPlan', plan })}
          />
        ))}
      </View>

      <View>
        <SectionLabel
          title={t('casa.equipments')}
          count={equipments.length || undefined}
          right={
            <Button
              variant="ghost"
              icon={Plus}
              label={t('casa.newEquipment')}
              onPress={() => setDialog({ kind: 'equipment' })}
            />
          }
        />
        {home.data && equipments.length === 0 && (
          <Text className="px-2 py-3 text-sm text-ink-muted">{t('casa.empty')}</Text>
        )}
        {equipments.map((e) => {
          const own = plans.filter((p) => p.equipment_id === e.id);
          const details = [e.room, [e.brand, e.model].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(' · ');
          return (
            <View
              key={e.id}
              className="min-h-14 flex-row items-center gap-3 border-b border-line px-2 py-2"
              {...contextMenu(() => setDialog({ kind: 'menuEquipment', equipment: e }))}
            >
              <Icon icon={Wrench} tone="ink-muted" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink">{e.name}</Text>
                {!!details && <Text className="text-xs text-ink-muted">{details}</Text>}
                <Text className="text-xs text-ink-muted">
                  {own.length
                    ? own.map((p) => p.name).join(', ')
                    : t('casa.noPlansFor')}
                  {e.purchased_on
                    ? ` · ${t('casa.boughtOn', { date: formatShortDate(e.purchased_on) })}`
                    : ''}
                </Text>
                <WarrantyLine equipment={e} today={today} />
              </View>
              <Button
                variant="ghost"
                icon={Plus}
                label={t('casa.newPlan')}
                accessibilityLabel={t('casa.newPlanFor', { name: e.name })}
                onPress={() => setDialog({ kind: 'plan', equipment: e })}
              />
              <IconButton
                icon={Ellipsis}
                label={t('casa.options', { name: e.name })}
                onPress={() => setDialog({ kind: 'menuEquipment', equipment: e })}
              />
            </View>
          );
        })}
      </View>

      {dialog?.kind === 'equipment' && (
        <EquipmentForm
          equipment={dialog.equipment}
          onClose={close}
          onSave={(fields) => {
            const { equipment } = dialog;
            close();
            if (equipment)
              actions.updateEquipment.mutate({ id: equipment.id, fields }, { onError: fail });
            else
              actions.addEquipment.mutate(
                { id: newHomeId(), device_id: null, warranty_ends_on: null, ...fields },
                { onError: fail },
              );
          }}
        />
      )}
      {dialog?.kind === 'plan' && (
        <PlanForm
          equipment={dialog.equipment}
          plan={dialog.plan}
          onClose={close}
          onSave={(fields) => {
            const { plan, equipment } = dialog;
            close();
            if (plan) actions.updatePlan.mutate({ id: plan.id, fields }, { onError: fail });
            else
              actions.addPlan.mutate(
                {
                  id: newHomeId(),
                  equipment_id: equipment.id,
                  page_id: null,
                  paused: false,
                  next_on: null,
                  task_id: null,
                  ...fields,
                },
                { onError: fail },
              );
          }}
        />
      )}
      {dialog?.kind === 'menuEquipment' && (
        <ActionMenu
          title={dialog.equipment.name}
          onClose={close}
          actions={[
            {
              label: t('casa.newPlan'),
              onPress: () => setDialog({ kind: 'plan', equipment: dialog.equipment }),
            },
            {
              label: t('common.edit'),
              onPress: () => setDialog({ kind: 'equipment', equipment: dialog.equipment }),
            },
            {
              label: t('common.delete'),
              destructive: true,
              onPress: () => setDialog({ kind: 'removeEquipment', equipment: dialog.equipment }),
            },
          ]}
        />
      )}
      {dialog?.kind === 'menuPlan' && (
        <ActionMenu
          title={dialog.plan.name}
          onClose={close}
          actions={[
            {
              label: t('common.edit'),
              onPress: () => {
                const equipment = equipments.find((e) => e.id === dialog.plan.equipment_id);
                if (equipment) setDialog({ kind: 'plan', equipment, plan: dialog.plan });
              },
            },
            {
              label: t(dialog.plan.paused ? 'casa.resume' : 'casa.pause'),
              onPress: () => {
                const { plan } = dialog;
                actions.updatePlan.mutate(
                  { id: plan.id, fields: { paused: !plan.paused } },
                  { onError: fail },
                );
              },
            },
            {
              label: t('common.delete'),
              destructive: true,
              onPress: () => setDialog({ kind: 'removePlan', plan: dialog.plan }),
            },
          ]}
        />
      )}
      {dialog?.kind === 'removeEquipment' && (
        <ConfirmDialog
          destructive
          title={t('casa.removeEquipment', { name: dialog.equipment.name })}
          message={t('casa.removeEquipmentHint')}
          confirmLabel={t('common.delete')}
          onClose={close}
          onConfirm={() => {
            const { equipment } = dialog;
            close();
            actions.removeEquipment.mutate(equipment.id, { onError: fail });
          }}
        />
      )}
      {dialog?.kind === 'removePlan' && (
        <ConfirmDialog
          destructive
          title={t('casa.removePlan', { name: dialog.plan.name })}
          message={t('casa.removePlanHint')}
          confirmLabel={t('common.delete')}
          onClose={close}
          onConfirm={() => {
            const { plan } = dialog;
            close();
            actions.removePlan.mutate(plan.id, { onError: fail });
          }}
        />
      )}
    </View>
  );
}

function useEveryLabel() {
  const { t } = useTranslation();
  return (p: Pick<MaintenancePlan, 'every_n' | 'unit'>) =>
    t(p.unit === 'dias' ? 'casa.everyDays' : 'casa.everyMonths', { count: p.every_n });
}

function PlanRow({
  plan,
  equipment,
  today,
  onDone,
  onMenu,
}: {
  plan: MaintenancePlan;
  equipment: string;
  today: string;
  onDone: () => void;
  onMenu: () => void;
}) {
  const { t } = useTranslation();
  const every = useEveryLabel();
  const status = planStatus(plan, today);
  const next = planNext(plan, today);
  const when =
    status === 'paused'
      ? t('casa.paused')
      : status === 'late'
        ? t('casa.late', { date: formatShortDate(next) })
        : t('casa.next', { date: formatDueDate(next, today) });
  const last = plan.last_done_on
    ? t('casa.lastDone', { date: formatShortDate(plan.last_done_on) })
    : t('casa.neverDone');
  return (
    <View
      className="min-h-14 flex-row items-center gap-3 border-b border-line px-2 py-2"
      accessibilityLabel={`${plan.name}, ${equipment}: ${when}`}
      {...contextMenu(onMenu)}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">
          {plan.name} <Text className="font-normal text-ink-muted">· {equipment}</Text>
        </Text>
        <Text className="text-xs text-ink-muted">
          {every(plan)} · {last}
        </Text>
        <Text
          className={cn(
            'text-xs',
            status === 'late'
              ? 'font-semibold text-danger'
              : status === 'today' || status === 'soon'
                ? 'font-semibold text-warn'
                : 'text-ink-muted',
          )}
        >
          {when}
        </Text>
      </View>
      {!plan.paused && (
        <Button
          variant="ghost"
          label={t('casa.done')}
          accessibilityLabel={t('casa.doneFor', { name: plan.name })}
          disabled={!plan.task_id}
          onPress={onDone}
        />
      )}
      <IconButton icon={Ellipsis} label={t('casa.options', { name: plan.name })} onPress={onMenu} />
    </View>
  );
}

type EquipmentFields = Omit<Equipment, 'id' | 'device_id' | 'warranty_ends_on'>;

/** "Garantia até 25/12/2026 (30 dias)", "Garantia: informe a data da compra", "Garantia acabou". */
function WarrantyLine({ equipment, today }: { equipment: Equipment; today: string }) {
  const { t } = useTranslation();
  const w = warrantyState(equipment, today);
  if (w.kind === 'none') return null;
  const text =
    w.kind === 'needsDate'
      ? t('casa.warrantyNeedsDate')
      : w.kind === 'expired'
        ? t('casa.warrantyExpired', { date: formatShortDate(w.ends) })
        : t('casa.warrantyUntil', { date: formatShortDate(w.ends), count: w.daysLeft });
  return (
    <Text
      className={cn(
        'text-xs',
        w.kind === 'needsDate' || (w.kind === 'active' && w.daysLeft <= 30)
          ? 'font-semibold text-warn'
          : 'text-ink-muted',
      )}
    >
      {text}
    </Text>
  );
}

function EquipmentForm({
  equipment,
  onSave,
  onClose,
}: {
  equipment?: Equipment;
  onSave: (fields: EquipmentFields) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const [name, setName] = useState(equipment?.name ?? '');
  const [room, setRoom] = useState(equipment?.room ?? '');
  const [brand, setBrand] = useState(equipment?.brand ?? '');
  const [model, setModel] = useState(equipment?.model ?? '');
  const [bought, setBought] = useState(
    equipment?.purchased_on ? formatDayInput(equipment.purchased_on) : '',
  );
  const boughtOn = bought.trim() ? parsePastDay(bought, today) : null;
  // Garantia: meses a partir da compra ou até uma data (CS3)
  const [wKind, setWKind] = useState<'none' | 'months' | 'until'>(
    equipment?.warranty_until ? 'until' : equipment?.warranty_months ? 'months' : 'none',
  );
  const [wMonths, setWMonths] = useState(
    equipment?.warranty_months ? String(equipment.warranty_months) : '12',
  );
  const [wUntil, setWUntil] = useState(
    equipment?.warranty_until ? formatDayInput(equipment.warranty_until) : '',
  );
  const [expenseId, setExpenseId] = useState(equipment?.expense_id ?? null);
  const [picking, setPicking] = useState(false);
  const expenses = useMyExpenses(picking || !!expenseId);
  const months = Number(wMonths);
  const untilOn = wUntil.trim() ? parseDay(wUntil, today) : null;
  const warrantyOk =
    wKind === 'none' ||
    (wKind === 'months' && Number.isInteger(months) && months >= 1 && months <= 240) ||
    (wKind === 'until' && untilOn != null);
  const valid = name.trim().length > 0 && (!bought.trim() || boughtOn != null) && warrantyOk;
  const clean = (s: string) => s.trim() || null;
  const expense = expenses.data?.find((x) => x.id === expenseId);

  function save() {
    if (!valid) return;
    onSave({
      name: name.trim(),
      room: clean(room),
      brand: clean(brand),
      model: clean(model),
      purchased_on: boughtOn,
      notes: equipment?.notes ?? null,
      warranty_months: wKind === 'months' ? months : null,
      warranty_until: wKind === 'until' ? untilOn : null,
      expense_id: expenseId,
    });
  }

  return (
    <DialogFrame wide onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">
        {equipment ? t('casa.editEquipment') : t('casa.newEquipment')}
      </Text>
      <Input
        placeholder={t('casa.namePlaceholder')}
        accessibilityLabel={t('casa.name')}
        value={name}
        maxLength={120}
        autoFocus={!equipment}
        onChangeText={setName}
      />
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-sm text-ink">{t('casa.room')}</Text>
          <Input accessibilityLabel={t('casa.room')} value={room} maxLength={60} onChangeText={setRoom} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm text-ink">{t('casa.brand')}</Text>
          <Input accessibilityLabel={t('casa.brand')} value={brand} maxLength={60} onChangeText={setBrand} />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-sm text-ink">{t('casa.model')}</Text>
          <Input accessibilityLabel={t('casa.model')} value={model} maxLength={80} onChangeText={setModel} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm text-ink">{t('casa.purchased')}</Text>
          <Input
            accessibilityLabel={t('casa.purchased')}
            value={bought}
            placeholder={t('casa.datePlaceholder')}
            onChangeText={setBought}
            onSubmitEditing={save}
          />
        </View>
      </View>
      {!!bought.trim() && boughtOn == null && (
        <Text className="text-sm text-danger">{t('casa.badDate')}</Text>
      )}
      <View className="gap-1">
        <Text className="text-sm text-ink">{t('casa.warranty')}</Text>
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityRole="radiogroup"
          accessibilityLabel={t('casa.warranty')}
        >
          {(['none', 'months', 'until'] as const).map((k) => (
            <Chip
              key={k}
              role="radio"
              label={t(`casa.warrantyKind.${k}`)}
              selected={wKind === k}
              onPress={() => setWKind(k)}
            />
          ))}
        </View>
        {wKind === 'months' && (
          <View className="flex-row items-center gap-2">
            <Input
              className="w-20"
              accessibilityLabel={t('casa.warrantyMonths')}
              keyboardType="number-pad"
              value={wMonths}
              onChangeText={setWMonths}
            />
            <Text className="text-sm text-ink-muted">{t('casa.warrantyMonthsHint')}</Text>
          </View>
        )}
        {wKind === 'until' && (
          <Input
            accessibilityLabel={t('casa.warrantyUntilLabel')}
            value={wUntil}
            placeholder={t('casa.datePlaceholder')}
            onChangeText={setWUntil}
          />
        )}
        {wKind === 'months' && !bought.trim() && (
          <Text className="text-xs text-warn">{t('casa.warrantyNeedsDate')}</Text>
        )}
        {wKind === 'until' && !!wUntil.trim() && untilOn == null && (
          <Text className="text-sm text-danger">{t('casa.badDate')}</Text>
        )}
      </View>
      <View className="gap-1">
        <Text className="text-sm text-ink">{t('casa.receipt')}</Text>
        {expenseId ? (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm text-ink" numberOfLines={1}>
              {expense
                ? `${expense.description} · ${formatMoney(expense.amount_cents, expense.currency, i18n.language)} · ${formatShortDate(expense.spent_on)}`
                : t('casa.receiptLinked')}
            </Text>
            <Button variant="ghost" label={t('casa.receiptRemove')} onPress={() => setExpenseId(null)} />
          </View>
        ) : picking ? (
          <ExpensePicker
            options={expenses.data ?? []}
            loading={expenses.isPending}
            onPick={(id) => {
              setExpenseId(id);
              setPicking(false);
            }}
          />
        ) : (
          <Button
            variant="ghost"
            className="self-start"
            label={t('casa.receiptPick')}
            onPress={() => setPicking(true)}
          />
        )}
      </View>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} disabled={!valid} onPress={save} />
      </View>
    </DialogFrame>
  );
}

/** Os gastos lançados pela pessoa, com busca, para ligar a nota fiscal (CS3). */
function ExpensePicker({
  options,
  loading,
  onPick,
}: {
  options: ExpenseOption[];
  loading: boolean;
  onPick: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = options.filter((o) => !term || o.description.toLowerCase().includes(term)).slice(0, 8);
  return (
    <View className="gap-1">
      <Input
        accessibilityLabel={t('casa.receiptSearch')}
        placeholder={t('casa.receiptSearch')}
        value={q}
        onChangeText={setQ}
      />
      {loading ? (
        <Text className="text-sm text-ink-muted">{t('common.loading')}</Text>
      ) : list.length === 0 ? (
        <Text className="text-sm text-ink-muted">{t('casa.receiptNone')}</Text>
      ) : (
        list.map((o) => (
          <Button
            key={o.id}
            variant="ghost"
            className="self-start"
            label={`${o.description} · ${formatMoney(o.amount_cents, o.currency, i18n.language)} · ${formatShortDate(o.spent_on)}`}
            onPress={() => onPick(o.id)}
          />
        ))
      )}
    </View>
  );
}

type PlanFields = Pick<MaintenancePlan, 'name' | 'every_n' | 'unit' | 'last_done_on'>;

function PlanForm({
  equipment,
  plan,
  onSave,
  onClose,
}: {
  equipment: Equipment;
  plan?: MaintenancePlan;
  onSave: (fields: PlanFields) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const [name, setName] = useState(plan?.name ?? '');
  const [every, setEvery] = useState(plan ? String(plan.every_n) : '3');
  const [unit, setUnit] = useState<MaintenanceUnit>(plan?.unit ?? 'meses');
  const [last, setLast] = useState(plan?.last_done_on ? formatDayInput(plan.last_done_on) : '');
  const n = Number(every);
  const lastOn = last.trim() ? parsePastDay(last, today) : null;
  const valid =
    name.trim().length > 0 &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= 999 &&
    (!last.trim() || lastOn != null);

  function save() {
    if (!valid) return;
    onSave({ name: name.trim(), every_n: n, unit, last_done_on: lastOn });
  }

  return (
    <DialogFrame wide onClose={onClose}>
      <Text className="text-lg font-semibold text-ink">
        {plan ? t('casa.editPlan') : t('casa.newPlanFor', { name: equipment.name })}
      </Text>
      <Input
        placeholder={t('casa.planPlaceholder')}
        accessibilityLabel={t('casa.planName')}
        value={name}
        maxLength={120}
        autoFocus={!plan}
        onChangeText={setName}
      />
      <View className="gap-1">
        <Text className="text-sm text-ink">{t('casa.every')}</Text>
        <View className="flex-row items-center gap-2">
          <Input
            className="w-20"
            accessibilityLabel={t('casa.every')}
            keyboardType="number-pad"
            value={every}
            onChangeText={setEvery}
          />
          <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel={t('casa.unit')}>
            {(['dias', 'meses'] as const).map((u) => (
              <Chip
                key={u}
                role="radio"
                label={t(u === 'dias' ? 'casa.days' : 'casa.months')}
                selected={unit === u}
                onPress={() => setUnit(u)}
              />
            ))}
          </View>
        </View>
      </View>
      <View className="gap-1">
        <Text className="text-sm text-ink">{t('casa.lastDoneLabel')}</Text>
        <Input
          accessibilityLabel={t('casa.lastDoneLabel')}
          value={last}
          placeholder={t('casa.lastDonePlaceholder')}
          onChangeText={setLast}
          onSubmitEditing={save}
        />
        {!!last.trim() && lastOn == null ? (
          <Text className="text-sm text-danger">{t('casa.badDate')}</Text>
        ) : (
          <Text className="text-xs text-ink-muted">{t('casa.planHint')}</Text>
        )}
      </View>
      <View className="flex-row justify-end gap-2">
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} disabled={!valid} onPress={save} />
      </View>
    </DialogFrame>
  );
}
