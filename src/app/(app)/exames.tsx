import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { FileText, Paperclip, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';

import { HealthConsentGate, HealthNotice } from '@/components/health/health-privacy';
import { READABLE, Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button, IconButton } from '@/components/ui/button';
import { ActionMenu, ConfirmDialog, DialogFrame } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  chartRange,
  EXAM_LIMITS,
  formatExamValue,
  groupExams,
  parseExamValue,
  parseOptionalValue,
  refText,
  type ExamGroup,
  type ExamResult,
} from '@/lib/exams';
import { formatDayInput, parsePastDay } from '@/lib/maintenance';
import { openUrl } from '@/lib/open-url';
import type { IsoDate } from '@/lib/parser/dates';
import { examFileUrl, useExamActions, useExams } from '@/lib/queries/exams';
import { useToday } from '@/lib/queries/profile';
import { useColors } from '@/lib/tokens';
import { uuidv7 } from '@/lib/uuid';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Exames (SA4, D389): resultados digitados (data, nome, valor, unidade, a faixa que a pessoa
// digita) com um gráfico por exame e anexo opcional (foto ou PDF). Sem interpretação: a faixa é só
// texto e uma faixa no gráfico, nada de "alto", "baixo" ou cor de alerta. Bem-estar → Exames.
export default function ExamsScreen() {
  const { t } = useTranslation();
  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader back help="bem-estar" title={t('exams.title')} />
        <HealthConsentGate>
          <ExamsBody />
          <HealthNotice />
        </HealthConsentGate>
      </ScreenScroll>
    </Screen>
  );
}

type Editing = { exam: ExamResult | null; template?: ExamResult } | null;

function ExamsBody() {
  const { t, i18n } = useTranslation();
  const exams = useExams();
  const actions = useExamActions();
  const toast = useToast();
  const online = useIsOnline();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<ExamResult | null>(null);
  const [attaching, setAttaching] = useState<ExamResult | null>(null);
  const fail = (e: Error) => toast({ message: e.message });
  if (!exams.data) return null;
  const groups = groupExams(exams.data);
  const date = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  const value = (r: ExamResult) =>
    `${formatExamValue(r.value, i18n.language)}${r.unit ? ` ${r.unit}` : ''}`;

  async function open(r: ExamResult) {
    if (!r.file_path) return;
    try {
      await openUrl(await examFileUrl(r.file_path));
    } catch (e) {
      fail(e as Error);
    }
  }

  async function pick(r: ExamResult, source: 'camera' | 'gallery' | 'file') {
    setAttaching(null);
    let file: { uri: string; mime?: string | null; width?: number; height?: number } | null = null;
    if (source === 'file') {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        base64: false,
      });
      if (res.canceled) return;
      file = { uri: res.assets[0].uri, mime: res.assets[0].mimeType };
    } else {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return toast({ message: t('attach.noCamera') });
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled) return;
      const a = res.assets[0];
      file = {
        uri: a.uri,
        mime: a.mimeType ?? a.file?.type ?? 'image/jpeg',
        width: a.width,
        height: a.height,
      };
    }
    actions.attach.mutate(
      { id: r.id, file },
      { onSuccess: () => toast({ message: t('exams.attached') }), onError: fail },
    );
  }

  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap gap-2">
        <Button label={t('exams.add')} onPress={() => setEditing({ exam: null })} />
      </View>

      {groups.length === 0 ? (
        <Text className={`text-ink-muted ${READABLE}`}>{t('exams.empty')}</Text>
      ) : (
        groups.map((g) => (
          <View key={g.key} className="gap-3" accessibilityLabel={g.name}>
            <View className="flex-row items-baseline justify-between gap-2">
              <Text className="flex-1 font-serif text-xl text-ink" accessibilityRole="header">
                {g.name}
              </Text>
              <Button
                variant="ghost"
                label={t('exams.addResult')}
                accessibilityLabel={t('exams.addResultOf', { name: g.name })}
                onPress={() => setEditing({ exam: null, template: g.latest })}
              />
            </View>
            <Text className="text-sm text-ink-muted">
              {t('exams.latest', { value: value(g.latest), date: date(g.latest.day) })}
              {refText(g.latest.ref_low, g.latest.ref_high, g.latest.unit, i18n.language)
                ? ` · ${t('exams.ref', { range: refText(g.latest.ref_low, g.latest.ref_high, g.latest.unit, i18n.language) })}`
                : ''}
            </Text>
            <ExamChart
              group={g}
              label={t('exams.chart', { name: g.name, count: g.results.length })}
            />
            <View>
              {[...g.results].reverse().map((r) => (
                <View
                  key={r.id}
                  className="min-h-11 flex-row items-center gap-2 border-b border-line"
                >
                  <Text className="w-24 text-sm text-ink-muted">{date(r.day)}</Text>
                  <View className="flex-1">
                    <Text className="text-sm text-ink">{value(r)}</Text>
                    {!!r.note && <Text className="text-xs text-ink-muted">{r.note}</Text>}
                  </View>
                  {r.file_path ? (
                    <IconButton
                      icon={FileText}
                      label={t('exams.openFile', { date: date(r.day) })}
                      onPress={() => void open(r)}
                    />
                  ) : (
                    <IconButton
                      icon={Paperclip}
                      label={t('exams.attach', { date: date(r.day) })}
                      disabled={!online || actions.attach.isPending}
                      onPress={() => setAttaching(r)}
                    />
                  )}
                  <IconButton
                    icon={Pencil}
                    label={t('exams.edit', { date: date(r.day) })}
                    onPress={() => setEditing({ exam: r })}
                  />
                  <IconButton
                    icon={Trash2}
                    tone="danger"
                    label={t('exams.remove', { date: date(r.day) })}
                    onPress={() => setRemoving(r)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))
      )}
      {!online && groups.length > 0 && (
        <Text className="text-sm text-ink-muted">{t('exams.offlineFile')}</Text>
      )}

      {editing && (
        <ExamForm
          exam={editing.exam}
          template={editing.template}
          names={groups.map((g) => g.name)}
          onClose={() => setEditing(null)}
          onDetach={
            editing.exam?.file_path
              ? () => {
                  const id = editing.exam?.id;
                  setEditing(null);
                  if (id) actions.detach.mutate(id, { onError: fail });
                }
              : undefined
          }
          onSave={(exam) => {
            setEditing(null);
            actions.save.mutate({ exam, isNew: !editing.exam }, { onError: fail });
          }}
        />
      )}
      {attaching && (
        <ActionMenu
          title={t('exams.attachTitle')}
          onClose={() => setAttaching(null)}
          actions={[
            { label: t('expenses.photo.camera'), onPress: () => void pick(attaching, 'camera') },
            { label: t('expenses.photo.gallery'), onPress: () => void pick(attaching, 'gallery') },
            { label: t('exams.pdf'), onPress: () => void pick(attaching, 'file') },
          ]}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t('exams.removeTitle')}
          message={t('exams.removeBody', { name: removing.name, date: date(removing.day) })}
          confirmLabel={t('common.delete')}
          destructive
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            const id = removing.id;
            setRemoving(null);
            actions.remove.mutate(id, { onError: fail });
          }}
        />
      )}
    </View>
  );
}

const HEIGHT = 140;
const PAD = 10;

/** Valores no tempo (espaçados pela data) e a faixa digitada como uma banda clara. */
function ExamChart({ group, label }: { group: ExamGroup; label: string }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  if (group.results.length < 2) return null;
  const { min, max } = chartRange(group);
  const t0 = Date.parse(`${group.results[0].day}T00:00:00Z`);
  const t1 = Date.parse(`${group.latest.day}T00:00:00Z`);
  const span = Math.max(t1 - t0, 1);
  const x = (day: string) =>
    PAD + ((Date.parse(`${day}T00:00:00Z`) - t0) * (width - PAD * 2)) / span;
  const y = (v: number) => PAD + ((max - v) * (HEIGHT - PAD * 2)) / (max - min);
  const { ref_low, ref_high } = group.latest;
  const bandTop = y(ref_high ?? max);
  const bandBottom = y(ref_low ?? min);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="h-36 w-full"
    >
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {(ref_low != null || ref_high != null) && (
            <Rect
              x={PAD}
              width={width - PAD * 2}
              y={bandTop}
              height={Math.max(1, bandBottom - bandTop)}
              fill={colors.line}
              opacity={0.6}
            />
          )}
          <Polyline
            points={group.results.map((r) => `${x(r.day)},${y(r.value)}`).join(' ')}
            stroke={colors.accent}
            strokeWidth={2.5}
            fill="none"
          />
          {group.results.map((r) => (
            <Circle key={r.id} cx={x(r.day)} cy={y(r.value)} r={3.5} fill={colors.accent} />
          ))}
        </Svg>
      )}
    </View>
  );
}

type Field = 'name' | 'day' | 'value' | 'unit' | 'low' | 'high' | 'note';

function ExamForm({
  exam,
  template,
  names,
  onSave,
  onDetach,
  onClose,
}: {
  exam: ExamResult | null;
  /** Novo resultado de um exame que já existe: o último dá o nome, a unidade e a faixa */
  template?: ExamResult;
  names: string[];
  onSave: (exam: Omit<ExamResult, 'file_path' | 'file_mime'>) => void;
  onDetach?: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const today = useToday() as IsoDate;
  const num = (v: number | null | undefined) =>
    v == null ? '' : formatExamValue(v, i18n.language).replace(/\s/g, '');
  const base = exam ?? template;
  const name = template?.name;
  const [values, setValues] = useState<Record<Field, string>>({
    name: base?.name ?? '',
    day: exam ? formatDayInput(exam.day) : formatDayInput(today),
    value: num(exam?.value),
    unit: base?.unit ?? '',
    low: num(base?.ref_low),
    high: num(base?.ref_high),
    note: exam?.note ?? '',
  });
  const set = (k: Field) => (text: string) => setValues((v) => ({ ...v, [k]: text }));
  const day = parsePastDay(values.day, today);
  const value = parseExamValue(values.value);
  const low = parseOptionalValue(values.low);
  const high = parseOptionalValue(values.high);
  const error = !values.name.trim()
    ? null
    : !day
      ? t('exams.badDay')
      : value === null && values.value.trim()
        ? t('exams.badValue')
        : low === undefined || high === undefined
          ? t('exams.badValue')
          : low != null && high != null && low > high
            ? t('exams.badRange')
            : null;
  const valid = !!values.name.trim() && !!day && value !== null && !error;

  function save() {
    if (!valid || !day || value === null || low === undefined || high === undefined) return;
    onSave({
      id: exam?.id ?? uuidv7(),
      day,
      name: values.name.trim(),
      value,
      unit: values.unit.trim(),
      ref_low: low,
      ref_high: high,
      note: values.note.trim(),
    });
  }

  const field = (k: Field, label: string, max: number, extra: object = {}) => (
    <View className="gap-1">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Input
        accessibilityLabel={label}
        value={values[k]}
        maxLength={max}
        onChangeText={set(k)}
        onSubmitEditing={save}
        {...extra}
      />
    </View>
  );

  return (
    <DialogFrame onClose={onClose}>
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
        {exam ? t('exams.editTitle') : t('exams.addTitle')}
      </Text>
      {field('name', t('exams.name'), EXAM_LIMITS.name, { autoFocus: !name && !exam })}
      {!exam && !name && names.length > 0 && !values.name && (
        <View className="flex-row flex-wrap gap-2">
          {names.slice(0, 8).map((n) => (
            <Button key={n} variant="ghost" label={n} onPress={() => set('name')(n)} />
          ))}
        </View>
      )}
      <View className="flex-row gap-2">
        <View className="flex-1">
          {field('value', t('exams.value'), 16, {
            keyboardType: 'decimal-pad',
            autoFocus: !!name || !!exam,
          })}
        </View>
        <View className="flex-1">{field('unit', t('exams.unit'), EXAM_LIMITS.unit)}</View>
      </View>
      {field('day', t('exams.day'), 10)}
      <Text className="text-sm text-ink-muted">{t('exams.refHint')}</Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          {field('low', t('exams.refLow'), 16, { keyboardType: 'decimal-pad' })}
        </View>
        <View className="flex-1">
          {field('high', t('exams.refHigh'), 16, { keyboardType: 'decimal-pad' })}
        </View>
      </View>
      {field('note', t('exams.note'), EXAM_LIMITS.note)}
      {error && <Text className="text-sm text-danger">{error}</Text>}
      <View className="flex-row flex-wrap justify-end gap-2">
        {onDetach && (
          <Button variant="ghost" destructive label={t('exams.detach')} onPress={onDetach} />
        )}
        <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
        <Button label={t('common.save')} onPress={save} disabled={!valid} />
      </View>
    </DialogFrame>
  );
}
