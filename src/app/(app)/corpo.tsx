import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { parseDecimal } from '@/components/gym/set-row';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { bodySummary, byDay, changes } from '@/lib/gym/body-trend';
import { fromKg, toKg } from '@/lib/gym/units';
import { formatShortDate, type IsoDate } from '@/lib/parser/dates';
import { BODY_KINDS, newBodyId, useBody, useBodyActions, type BodyKind } from '@/lib/queries/body';
import { useGymPrefs, useToday } from '@/lib/queries/profile';
import { useColors } from '@/lib/tokens';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Peso e medidas (AC7, V6 §6): dado sensível, só com o consentimento específico. Registro do dia,
 * meta, gráfico com a linha da meta (cada trecho pintado por ter aproximado ou afastado) e a
 * lista. Peso na unidade do Perfil (guardado em kg), gordura em %, medidas em cm.
 */
export default function BodyScreen() {
  const { t, i18n } = useTranslation();
  const body = useBody();
  const actions = useBodyActions();
  const online = useIsOnline();
  const toast = useToast();
  const today = useToday();
  const { unit } = useGymPrefs();
  const [kind, setKind] = useState<BodyKind>('weight');
  const [value, setValue] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [goalText, setGoalText] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const lang = i18n.language;

  const unitOf = (k: BodyKind) => (k === 'weight' ? unit : k === 'body_fat' ? '%' : 'cm');
  // Peso: guardado em kg, mostrado na unidade do Perfil
  const show = (k: BodyKind, v: number) => (k === 'weight' ? fromKg(v, unit) : v);
  const store = (k: BodyKind, v: number) =>
    k === 'weight' ? Math.round(toKg(v, unit) * 100) / 100 : v;
  const number = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(v);
  const label = (k: BodyKind, v: number) => `${number(show(k, v))} ${unitOf(k)}`;

  const data = body.data;
  if (data && !data.consent) {
    return (
      <Screen size="narrow">
        <ScreenHeader title={t('body.title')} back />
        <ScreenScroll contentContainerClassName="gap-4 pb-12">
          <View className={`gap-4 ${READABLE}`}>
            <Text className="text-lg font-semibold text-ink">{t('body.consentTitle')}</Text>
            <Text className="text-ink">{t('body.consentBody')}</Text>
            <Button
              label={t('body.consentAccept')}
              className="self-start"
              disabled={!online}
              loading={actions.consent.isPending}
              onPress={() =>
                actions.consent.mutate(true, { onError: (e) => toast({ message: e.message }) })
              }
            />
            {!online && <Text className="text-sm text-ink-muted">{t('body.consentOffline')}</Text>}
            <Button
              variant="ghost"
              className="self-start"
              label={t('body.consentPolicy')}
              onPress={() => router.push('/privacidade')}
            />
          </View>
        </ScreenScroll>
      </Screen>
    );
  }

  const entries = (data?.metrics ?? []).filter((m) => m.kind === kind);
  const goal = data?.goals.find((g) => g.kind === kind)?.target ?? null;
  const series = entries.map((m) => ({ day: m.measured_on, value: m.value }));
  const summary = bodySummary(series, goal);
  const date = day ?? today;
  const validDate = DATE_RE.test(date);

  function add() {
    const v = parseDecimal(value);
    if (v == null || v <= 0 || !validDate) {
      toast({ message: t('body.invalid') });
      return;
    }
    actions.add.mutate(
      { id: newBodyId(), kind, value: store(kind, v), measured_on: date, note: null },
      { onError: (e) => toast({ message: e.message }) },
    );
    setValue('');
    setDay(null);
  }

  return (
    <Screen size="medium">
      <ScreenHeader title={t('body.title')} back />
      <ScreenScroll contentContainerClassName="gap-6 pb-12">
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1">
          {BODY_KINDS.map((k) => (
            <Chip
              key={k}
              role="radio"
              label={t(`body.kind_${k}`)}
              selected={kind === k}
              onPress={() => {
                setKind(k);
                setGoalText(null);
              }}
            />
          ))}
        </View>

        <View className="flex-row flex-wrap items-end gap-3">
          <View className="w-32 gap-1">
            <Text className="text-xs text-ink-muted">
              {t('body.value', { unit: unitOf(kind) })}
            </Text>
            <Input
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              accessibilityLabel={t('body.value', { unit: unitOf(kind) })}
              onSubmitEditing={add}
            />
          </View>
          <View className="w-40 gap-1">
            <Text className="text-xs text-ink-muted">{t('body.date')}</Text>
            <Input
              value={date}
              onChangeText={setDay}
              accessibilityLabel={t('body.date')}
              maxLength={10}
            />
          </View>
          <Button label={t('body.add')} onPress={add} disabled={!value.trim()} />
        </View>

        {summary && (
          <View className="gap-1">
            <Text className="text-base text-ink">
              {t('body.latest', {
                value: label(kind, summary.latest.value),
                day: formatShortDate(summary.latest.day),
              })}
            </Text>
            {entries.length > 1 && (
              <Text className="text-sm text-ink-muted">
                {t('body.sinceFirst', {
                  value: `${summary.sinceFirst > 0 ? '+' : ''}${label(kind, summary.sinceFirst)}`,
                })}
              </Text>
            )}
            {summary.reached ? (
              <Text className="text-sm font-semibold text-ok">{t('body.reached')}</Text>
            ) : summary.toGoal != null ? (
              <Text className="text-sm text-ink-muted">
                {t('body.toGoal', { value: label(kind, Math.abs(summary.toGoal)) })}
                {summary.toward != null && ` · ${t(summary.toward ? 'body.toward' : 'body.away')}`}
              </Text>
            ) : null}
          </View>
        )}

        <BodyChart
          entries={series}
          goal={goal}
          label={t('body.chart', { kind: t(`body.kind_${kind}`) })}
          goalLabel={goal != null ? t('body.goalLine', { value: label(kind, goal) }) : null}
        />

        <View className="flex-row flex-wrap items-end gap-3">
          <View className="w-32 gap-1">
            <Text className="text-xs text-ink-muted">{t('body.goal', { unit: unitOf(kind) })}</Text>
            <Input
              value={goalText ?? (goal != null ? number(show(kind, goal)) : '')}
              onChangeText={setGoalText}
              keyboardType="decimal-pad"
              accessibilityLabel={t('body.goal', { unit: unitOf(kind) })}
            />
          </View>
          <Button
            variant="ghost"
            label={t('body.goalSave')}
            disabled={goalText == null}
            onPress={() => {
              const v = parseDecimal(goalText ?? '');
              if (goalText?.trim() && (v == null || v <= 0)) {
                toast({ message: t('body.invalid') });
                return;
              }
              actions.setGoal.mutate(
                { kind, target: v == null ? null : store(kind, v) },
                { onError: (e) => toast({ message: e.message }) },
              );
              setGoalText(null);
            }}
          />
          {goal != null && (
            <Button
              variant="ghost"
              label={t('body.goalClear')}
              onPress={() => actions.setGoal.mutate({ kind, target: null })}
            />
          )}
        </View>

        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('body.history')}
          </Text>
          {entries.length === 0 ? (
            <Text className="text-sm text-ink-muted">{t('body.empty')}</Text>
          ) : (
            [...entries].reverse().map((m) => (
              <View key={m.id} className="min-h-8 flex-row items-center gap-3">
                <Text className="w-28 text-sm text-ink-muted">
                  {formatShortDate(m.measured_on as IsoDate)}
                </Text>
                <Text className="flex-1 font-mono text-sm text-ink">{label(kind, m.value)}</Text>
                <IconButton tone="danger"
                  icon={Trash2}
                  label={t('body.delete')}
                  onPress={() => actions.remove.mutate(m.id)}
                />
              </View>
            ))
          )}
        </View>

        <Button destructive
          variant="ghost"
          className="self-start"
          label={t('body.revoke')}
          disabled={!online}
          onPress={() => setRevoking(true)}
        />
      </ScreenScroll>
      {revoking && (
        <ConfirmDialog destructive
          title={t('body.revokeTitle')}
          message={t('body.revokeBody')}
          confirmLabel={t('body.revokeConfirm')}
          onClose={() => setRevoking(false)}
          onConfirm={() => {
            setRevoking(false);
            actions.consent.mutate(false, { onError: (e) => toast({ message: e.message }) });
          }}
        />
      )}
    </Screen>
  );
}

const HEIGHT = 160;
const PAD = 8;

/** Linha do valor por dia, com a da meta tracejada; cada trecho na cor de aproximou/afastou. */
function BodyChart({
  entries,
  goal,
  label,
  goalLabel,
}: {
  entries: { day: string; value: number }[];
  goal: number | null;
  label: string;
  goalLabel: string | null;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const list = byDay(entries as { day: IsoDate; value: number }[]);
  if (list.length < 2) return null;
  const values = [...list.map((e) => e.value), ...(goal != null ? [goal] : [])];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  const x = (i: number) => PAD + (i * (width - PAD * 2)) / (list.length - 1);
  const y = (v: number) => PAD + ((max - v) * (HEIGHT - PAD * 2)) / span;
  const steps = changes(list, goal);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={[label, goalLabel].filter(Boolean).join(' · ')}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="h-40 w-full"
    >
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {goal != null && (
            <Line
              x1={PAD}
              x2={width - PAD}
              y1={y(goal)}
              y2={y(goal)}
              stroke={colors['ink-muted']}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {steps.map((s, i) => (
            <Polyline
              key={s.day}
              points={`${x(i)},${y(list[i].value)} ${x(i + 1)},${y(s.value)}`}
              stroke={s.toward == null ? colors.accent : s.toward ? colors.ok : colors.danger}
              strokeWidth={2.5}
              fill="none"
            />
          ))}
        </Svg>
      )}
    </View>
  );
}
