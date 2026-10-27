import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { diarySessions } from '@/lib/gym/history';
import {
  DEFAULT_RULE,
  defaultStep,
  PROGRESSION_RULES,
  prescribe,
  type Plan,
  readCoachPlan,
  type Prescription,
  type ProgressionRule,
} from '@/lib/gym/progression';
import type { WeightUnit } from '@/lib/gym/types';
import type { TaskMeta } from '@/lib/parser/quick';
import { useExercise } from '@/lib/queries/exercises';
import { useGymPrefs, useTimeZone, useToday } from '@/lib/queries/profile';
import { useReceivedPages } from '@/lib/queries/shares';
import type { Task } from '@/lib/queries/tasks';
import { useTree } from '@/lib/queries/tree';
import { useWorkoutHistory } from '@/lib/queries/workout-sets';
import { readRepeatPlan } from '@/lib/repeat';
import { parseWeight } from '@/lib/workout';
import { parseDecimal } from './set-row';

const isRule = (v: unknown): v is ProgressionRule =>
  typeof v === 'string' && (PROGRESSION_RULES as string[]).includes(v);

/** O plano do item: carga (na unidade dele), reps, séries e tempo. */
export function planOf(task: Task, fallbackUnit: WeightUnit): Plan {
  const meta = (task.meta && typeof task.meta === 'object' ? task.meta : {}) as TaskMeta;
  const repeat = readRepeatPlan(task.repeat_plan);
  const weight = parseWeight(meta.weight);
  return {
    weight: weight?.value ?? null,
    unit: weight ? (weight.unit.startsWith('lb') ? 'lb' : 'kg') : fallbackUnit,
    reps: meta.reps ?? null,
    seconds: repeat?.mode === 'timed' ? (repeat.duration_seconds ?? null) : null,
    sets: repeat?.total ?? meta.sets ?? 1,
  };
}

/**
 * A progressão do item (AC6.3): regra do exercício, senão a do treino, senão a padrão (dupla);
 * degrau próprio ou o da parte do corpo; prescrição tirada do diário. `excludeToday`: no Modo
 * Treino, a sessão de hoje ainda está acontecendo e não conta. Na página recebida, o que o
 * treinador definiu para o aluno vem antes (AC13.2): a regra e a carga inicial (`coach`).
 */
export function useProgression(task: Task, { excludeToday = false } = {}) {
  const tree = useTree();
  const received = useReceivedPages().data?.find((p) => p.id === task.page_id);
  const page = tree.data?.pages.find((p) => p.id === task.page_id) ?? received;
  const coach = received ? readCoachPlan(received.coach_plan, task.id) : null;
  const exercise = useExercise(task.exercise_id);
  const history = useWorkoutHistory({ exerciseId: task.exercise_id, taskId: task.id });
  const timeZone = useTimeZone();
  const today = useToday();
  const { unit: prefUnit } = useGymPrefs();

  const pageRule: ProgressionRule = isRule(page?.progression) ? page.progression : DEFAULT_RULE;
  const own = isRule(task.progression) ? task.progression : null;
  const rule = coach?.progression ?? own ?? pageRule;
  const coachWeight = parseWeight(coach?.weight);
  const plan = coachWeight
    ? {
        ...planOf(task, prefUnit),
        weight: coachWeight.value,
        unit: coachWeight.unit.startsWith('lb') ? ('lb' as const) : ('kg' as const),
      }
    : planOf(task, prefUnit);
  const autoStep = defaultStep(exercise.data?.body_part, plan.unit);
  const step = task.progression_step ?? autoStep;
  const sessions = diarySessions(history.data ?? [], timeZone, plan.unit).filter(
    (s) => !excludeToday || s.day !== today,
  );
  const prescription = history.isPending ? null : prescribe(rule, plan, sessions, step);
  // Lido de novo nesta abertura (o cache do disco pode trazer a regra ou o diário de antes)
  const fresh = history.isFetchedAfterMount && !history.isFetching;
  return { rule, own, pageRule, plan, step, autoStep, prescription, fresh, coach, received: !!received };
}

/**
 * O plano do item com a prescrição: a carga no mesmo formato do texto ("42,5kg"; sem carga antes,
 * o separador do idioma) e as repetições. Séries e o resto ficam como estavam.
 */
export function prescriptionMeta(
  meta: TaskMeta,
  p: Prescription,
  unit: WeightUnit,
  decimalComma: boolean,
): TaskMeta {
  const sep = parseWeight(meta.weight)?.sep ?? (decimalComma ? ',' : '.');
  const weight =
    p.weight != null
      ? `${String(Math.round(p.weight * 100) / 100).replace('.', sep)}${unit}`
      : meta.weight;
  return {
    ...meta,
    ...(weight ? { weight } : {}),
    ...(p.reps != null ? { reps: p.reps } : {}),
  };
}

/** "Subiu 2,5 kg: fez 3×10 na última" */
export function useWhy() {
  const { t, i18n } = useTranslation();
  const number = (v: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(v);
  return (p: Prescription, unit: WeightUnit) => {
    const vars = { ...(p.why.vars ?? {}) };
    const weightRule = p.why.key !== 'progression.upTime';
    if (typeof vars.step === 'number')
      vars.step = weightRule ? `${number(vars.step)} ${unit}` : number(vars.step);
    if (typeof vars.weight === 'number') vars.weight = `${number(vars.weight)} ${unit}`;
    return t(p.why.key as 'progression.up', vars);
  };
}

/** Texto do plano prescrito: "42,5 kg · 10 reps" (ou "50 s"). */
export function usePrescriptionLabel() {
  const { t, i18n } = useTranslation();
  const number = (v: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(v);
  return (p: Prescription, unit: WeightUnit) =>
    [
      p.weight != null ? `${number(p.weight)} ${unit}` : null,
      p.reps != null ? t('workout.reps', { count: p.reps }) : null,
      p.seconds != null ? t('diary.seconds', { count: p.seconds }) : null,
    ]
      .filter(Boolean)
      .join(' · ');
}

/** Painel do exercício: regra (ou a do treino), degrau e a próxima prescrição com o porquê. */
export function ProgressionEditor({
  task,
  editable,
  onSave,
}: {
  task: Task;
  editable: boolean;
  onSave: (patch: {
    progression?: ProgressionRule | null;
    progression_step?: number | null;
  }) => void;
}) {
  const { t, i18n } = useTranslation();
  const { own, pageRule, plan, step, autoStep, prescription, coach } = useProgression(task);
  // Aluno de página recebida: a regra do treinador manda e não se muda daqui (AC13.2)
  const chosen = coach?.progression ?? own;
  const why = useWhy();
  const label = usePrescriptionLabel();
  const number = (v: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(v);
  const ruleName = (r: ProgressionRule) => t(`progression.rule_${r}`);
  // O que está sendo digitado no degrau (null: mostra o salvo)
  const [stepText, setStepText] = useState<string | null>(null);

  return (
    <View className="gap-2">
      <Text className="text-sm text-ink">{t('progression.title')}</Text>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1">
        <Chip
          role="radio"
          label={t('progression.ruleInherit', { rule: ruleName(pageRule) })}
          selected={chosen == null}
          disabled={!editable}
          onPress={() => onSave({ progression: null })}
        />
        {PROGRESSION_RULES.map((r) => (
          <Chip
            key={r}
            role="radio"
            label={ruleName(r)}
            selected={chosen === r}
            disabled={!editable}
            onPress={() => onSave({ progression: r })}
          />
        ))}
      </View>
      {coach && <Text className="text-sm text-ink-muted">{t('progression.byCoach')}</Text>}
      {plan.weight != null && (
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-ink-muted">{t('progression.step')}</Text>
          <Input
            className="w-24"
            value={stepText ?? (task.progression_step != null ? number(task.progression_step) : '')}
            onChangeText={setStepText}
            placeholder={number(autoStep)}
            keyboardType="decimal-pad"
            editable={editable}
            accessibilityLabel={t('progression.step')}
            accessibilityHint={t('progression.stepHint', {
              step: `${number(autoStep)} ${plan.unit}`,
            })}
            onBlur={() => {
              if (stepText == null) return;
              const v = parseDecimal(stepText);
              setStepText(null);
              if (v !== (task.progression_step ?? null) && (v == null || v > 0))
                onSave({ progression_step: v });
            }}
          />
          <Text className="text-sm text-ink-muted">{`${plan.unit} · ${number(step)}`}</Text>
        </View>
      )}
      {prescription && prescription.kind !== 'off' && (
        <View className="gap-1">
          <Text className="font-mono text-sm text-ink">
            {t('progression.next', { value: label(prescription, plan.unit) || '—' })}
          </Text>
          <Text className="text-sm text-ink-muted">{why(prescription, plan.unit)}</Text>
        </View>
      )}
    </View>
  );
}

/** Configurar o treino: a regra que vale para os exercícios dele (cada um pode ter a sua). */
export function PageProgressionEditor({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (rule: ProgressionRule) => void;
}) {
  const { t } = useTranslation();
  const current = isRule(value) ? value : DEFAULT_RULE;
  return (
    <View className="gap-2">
      <Text className="text-sm text-ink-muted">{t('progression.pageRuleHint')}</Text>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1">
        {PROGRESSION_RULES.map((r) => (
          <Chip
            key={r}
            role="radio"
            label={t(`progression.rule_${r}`)}
            selected={current === r}
            onPress={() => onSave(r)}
          />
        ))}
      </View>
    </View>
  );
}

const SUPERSET_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Painel do exercício: a letra do superset (itens com a mesma letra se alternam, AC9.4). */
export function SupersetEditor({
  value,
  editable,
  onSave,
}: {
  value: string | null;
  editable: boolean;
  onSave: (superset: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Text className="text-sm text-ink">{t('superset.title')}</Text>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1">
        <Chip
          role="radio"
          label={t('superset.none')}
          selected={!value}
          disabled={!editable}
          onPress={() => onSave(null)}
        />
        {SUPERSET_LETTERS.map((letter) => (
          <Chip
            key={letter}
            role="radio"
            label={letter}
            selected={value === letter}
            disabled={!editable}
            onPress={() => onSave(letter)}
          />
        ))}
      </View>
      <Text className="text-xs text-ink-muted">{t('superset.hint')}</Text>
    </View>
  );
}
