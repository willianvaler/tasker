import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { DialogFrame } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { slugify, validSlug, type AskLevel, type BookingType } from '@/lib/booking';
import type { BookingTypeInput } from '@/lib/queries/booking';

const DURATIONS = [15, 30, 45, 60];
const ASK: AskLevel[] = ['off', 'optional', 'required'];

export const NEW_TYPE: BookingTypeInput = {
  slug: '',
  name: '',
  description: null,
  duration_min: 30,
  buffer_before: 0,
  buffer_after: 0,
  min_notice_min: 240,
  max_days: 30,
  daily_limit: null,
  ask_phone: 'off',
  ask_note: 'optional',
  needs_approval: false,
  active: true,
};

const int = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** Criar ou editar um tipo de compromisso (AG2, D311). Os limites são os do banco. */
export function BookingTypeForm({
  initial,
  taken,
  saving,
  error,
  onSave,
  onDelete,
  onClose,
}: {
  initial: BookingTypeInput & { id?: string };
  /** Apelidos já usados pelos outros tipos */
  taken: string[];
  saving: boolean;
  error: string | null;
  onSave: (value: BookingTypeInput & { id?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [description, setDescription] = useState(initial.description ?? '');
  const [duration, setDuration] = useState(String(initial.duration_min));
  const [before, setBefore] = useState(String(initial.buffer_before));
  const [after, setAfter] = useState(String(initial.buffer_after));
  const [notice, setNotice] = useState(String(Math.round(initial.min_notice_min / 60)));
  const [maxDays, setMaxDays] = useState(String(initial.max_days));
  const [limit, setLimit] = useState(initial.daily_limit ? String(initial.daily_limit) : '');
  const [askPhone, setAskPhone] = useState(initial.ask_phone);
  const [askNote, setAskNote] = useState(initial.ask_note);
  const [approval, setApproval] = useState(initial.needs_approval);
  const [active, setActive] = useState(initial.active);

  const finalSlug = slugTouched ? slug : slugify(name);
  const values = {
    duration: int(duration),
    before: int(before),
    after: int(after),
    notice: int(notice),
    maxDays: int(maxDays),
    limit: limit.trim() ? int(limit) : null,
  };
  const problem = !name.trim()
    ? null
    : !validSlug(finalSlug)
      ? t('bookingTypes.slugInvalid')
      : taken.includes(finalSlug)
        ? t('bookingTypes.slugTaken')
        : values.duration === null || values.duration < 5 || values.duration > 480
          ? t('bookingTypes.durationInvalid')
          : values.before === null ||
              values.before > 240 ||
              values.after === null ||
              values.after > 240
            ? t('bookingTypes.bufferInvalid')
            : values.notice === null || values.notice > 720
              ? t('bookingTypes.noticeInvalid')
              : values.maxDays === null || values.maxDays < 1 || values.maxDays > 365
                ? t('bookingTypes.maxDaysInvalid')
                : limit.trim() && (values.limit === null || values.limit < 1 || values.limit > 50)
                  ? t('bookingTypes.limitInvalid')
                  : null;
  const ready = !!name.trim() && !problem;

  function save() {
    if (!ready) return;
    onSave({
      id: initial.id,
      slug: finalSlug,
      name: name.trim(),
      description: description.trim() || null,
      duration_min: values.duration ?? 30,
      buffer_before: values.before ?? 0,
      buffer_after: values.after ?? 0,
      min_notice_min: (values.notice ?? 0) * 60,
      max_days: values.maxDays ?? 30,
      daily_limit: values.limit,
      ask_phone: askPhone,
      ask_note: askNote,
      needs_approval: approval,
      active,
    });
  }

  const askChips = (value: AskLevel, set: (v: AskLevel) => void, label: string) => (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <View role="radiogroup" aria-label={label} className="flex-row flex-wrap gap-2">
        {ASK.map((level) => (
          <Chip
            key={level}
            role="radio"
            label={t(`bookingTypes.ask.${level}`)}
            selected={value === level}
            onPress={() => set(level)}
          />
        ))}
      </View>
    </View>
  );

  const field = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <View className="flex-1 gap-1">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <Input
        value={value}
        onChangeText={set}
        keyboardType="number-pad"
        accessibilityLabel={label}
      />
      {hint ? <Text className="text-xs text-ink-muted">{hint}</Text> : null}
    </View>
  );

  // Num diálogo por cima da tela (o Sheet é das rotas de modal), com rolagem por dentro
  return (
    <DialogFrame onClose={onClose} wide>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {initial.id ? t('bookingTypes.edit') : t('bookingTypes.new')}
      </Text>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
        <View className="gap-4 pb-4">
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('bookingTypes.name')}</Text>
            <Input
              value={name}
              onChangeText={setName}
              maxLength={80}
              autoFocus
              placeholder={t('bookingTypes.namePlaceholder')}
              accessibilityLabel={t('bookingTypes.name')}
            />
          </View>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('bookingTypes.slug')}</Text>
            <Input
              value={finalSlug}
              onChangeText={(v) => {
                setSlugTouched(true);
                setSlug(v.toLowerCase());
              }}
              maxLength={40}
              autoCapitalize="none"
              className="font-mono"
              accessibilityLabel={t('bookingTypes.slug')}
            />
            <Text className="text-xs text-ink-muted">{t('bookingTypes.slugHint')}</Text>
          </View>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('bookingTypes.duration')}</Text>
            <View
              role="radiogroup"
              aria-label={t('bookingTypes.duration')}
              className="flex-row flex-wrap items-center gap-2"
            >
              {DURATIONS.map((d) => (
                <Chip
                  key={d}
                  role="radio"
                  label={`${d} min`}
                  selected={duration === String(d)}
                  onPress={() => setDuration(String(d))}
                />
              ))}
              <Input
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                className="w-24"
                accessibilityLabel={t('bookingTypes.durationOther')}
              />
            </View>
          </View>
          <View className="flex-row gap-3">
            {field(t('bookingTypes.before'), before, setBefore)}
            {field(t('bookingTypes.after'), after, setAfter)}
          </View>
          <View className="flex-row gap-3">
            {field(t('bookingTypes.notice'), notice, setNotice, t('bookingTypes.noticeHint'))}
            {field(t('bookingTypes.maxDays'), maxDays, setMaxDays)}
            {field(t('bookingTypes.limit'), limit, setLimit, t('bookingTypes.limitHint'))}
          </View>
          {askChips(askPhone, setAskPhone, t('bookingTypes.askPhone'))}
          {askChips(askNote, setAskNote, t('bookingTypes.askNote'))}
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('bookingTypes.description')}</Text>
            <Input
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              className="min-h-20"
              accessibilityLabel={t('bookingTypes.description')}
            />
          </View>
          <ToggleRow
            title={t('bookingTypes.approval')}
            hint={t('bookingTypes.approvalHint')}
            value={approval}
            onChange={setApproval}
          />
          <ToggleRow
            title={t('bookingTypes.active')}
            hint={t('bookingTypes.activeHint')}
            value={active}
            onChange={setActive}
          />
          {(problem || error) && (
            <Text accessibilityRole="alert" className="text-sm text-danger">
              {problem ?? error}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-2">
            <Button label={t('common.save')} disabled={!ready} loading={saving} onPress={save} />
            {onDelete && (
              <Button
                variant="ghost"
                destructive
                label={t('bookingTypes.delete')}
                onPress={onDelete}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </DialogFrame>
  );
}

export type { BookingType };
