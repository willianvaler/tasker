import { ArrowDown, ArrowUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PomodoroStats } from '@/components/time-report';
import { useBreakIdeas } from '@/components/timer-bar';
import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import type { PomodoroSettings } from '@/lib/pomodoro';
import { usePomodoroSettings, useSavePomodoroSettings } from '@/lib/queries/pomodoro';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Pomodoro (K2, D130): durações, ciclos, iniciar sozinho e as sugestões de pausa do usuário.
// Cada campo salva ao sair dele.

const MAX_IDEAS = 30;

export default function PomodoroScreen() {
  const { t } = useTranslation();
  const settings = usePomodoroSettings();
  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader help="pomodoro" title={t('pomodoro.title')} back />
        <PomodoroStats />
        {settings.data && (
          // O cache do aparelho abre primeiro e pode estar atrás: o dado do servidor recomeça o
          // formulário (depois de salvar, é o mesmo, e nada muda)
          <SettingsForm key={JSON.stringify(settings.data)} initial={settings.data} />
        )}
      </ScreenScroll>
    </Screen>
  );
}

function SettingsForm({ initial }: { initial: PomodoroSettings }) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const save = useSavePomodoroSettings();
  const [settings, setSettings] = useState(initial);
  const defaultIdeas = useBreakIdeas();
  const ideas = settings.break_ideas ?? defaultIdeas;
  const [newIdea, setNewIdea] = useState('');

  const commit = (next: PomodoroSettings) => {
    setSettings(next);
    save.mutate(next, { onError: (err) => toast({ message: err.message }) });
  };

  const numbers = [
    { key: 'focus_minutes', label: t('pomodoro.focusMinutes'), max: 180 },
    { key: 'short_break_minutes', label: t('pomodoro.shortMinutes'), max: 60 },
    { key: 'long_break_minutes', label: t('pomodoro.longMinutes'), max: 120 },
    { key: 'cycles', label: t('pomodoro.cycles'), max: 12 },
  ] as const;

  const setIdeas = (list: string[]) => commit({ ...settings, break_ideas: list });
  const move = (i: number, delta: number) => {
    const list = [...ideas];
    const [item] = list.splice(i, 1);
    list.splice(i + delta, 0, item);
    setIdeas(list);
  };
  const add = () => {
    const idea = newIdea.trim().slice(0, 80);
    if (!idea || ideas.length >= MAX_IDEAS) return;
    setIdeas([...ideas, idea]);
    setNewIdea('');
  };

  return (
    <View className="gap-6">
      <View className="flex-row flex-wrap gap-3">
        {numbers.map((field) => (
          <NumberField
            key={field.key}
            label={field.label}
            value={settings[field.key]}
            max={field.max}
            disabled={!online}
            onSave={(value) => commit({ ...settings, [field.key]: value })}
          />
        ))}
      </View>
      <ToggleRow
        title={t('pomodoro.autoStart')}
        hint={t('pomodoro.autoStartHint')}
        value={settings.auto_start}
        disabled={!online}
        onChange={(auto_start) => commit({ ...settings, auto_start })}
      />

      <View className="gap-2">
        <SectionLabel title={t('pomodoro.ideas')} count={ideas.length} />
        <Text className="text-sm text-ink-muted">{t('pomodoro.ideasHint')}</Text>
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {(['random', 'sequence'] as const).map((order) => (
            <Chip
              key={order}
              role="radio"
              label={t(order === 'random' ? 'pomodoro.orderRandom' : 'pomodoro.orderSequence')}
              selected={settings.idea_order === order}
              disabled={!online}
              onPress={() => commit({ ...settings, idea_order: order })}
            />
          ))}
        </View>
        <View accessibilityRole="list">
          {ideas.map((idea, i) => (
            <View
              key={`${i}:${idea}`}
              className="min-h-11 flex-row items-center gap-1 border-b border-line"
            >
              <Text className="flex-1 text-base text-ink">{idea}</Text>
              <IconButton
                icon={ArrowUp}
                label={t('pomodoro.ideaUp', { idea })}
                disabled={!online || i === 0}
                onPress={() => move(i, -1)}
              />
              <IconButton
                icon={ArrowDown}
                label={t('pomodoro.ideaDown', { idea })}
                disabled={!online || i === ideas.length - 1}
                onPress={() => move(i, 1)}
              />
              <IconButton
                icon={X}
                label={t('pomodoro.ideaRemove', { idea })}
                disabled={!online}
                onPress={() => setIdeas(ideas.filter((_, j) => j !== i))}
              />
            </View>
          ))}
        </View>
        <View className="flex-row gap-2">
          <Input
            className="flex-1"
            value={newIdea}
            onChangeText={setNewIdea}
            onSubmitEditing={add}
            submitBehavior="submit"
            maxLength={80}
            editable={online}
            placeholder={t('pomodoro.ideaPlaceholder')}
            accessibilityLabel={t('pomodoro.ideaNew')}
          />
          <Button
            label={t('pomodoro.ideaAdd')}
            disabled={!online || !newIdea.trim() || ideas.length >= MAX_IDEAS}
            onPress={add}
          />
        </View>
        {settings.break_ideas && (
          <Button
            variant="ghost"
            className="self-start"
            label={t('pomodoro.ideasReset')}
            disabled={!online}
            onPress={() => commit({ ...settings, break_ideas: null })}
          />
        )}
      </View>
    </View>
  );
}

function NumberField({
  label,
  value,
  max,
  disabled,
  onSave,
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onSave: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  function save() {
    const n = parseInt(text, 10);
    const next = Number.isFinite(n) ? Math.max(1, Math.min(max, n)) : value;
    setText(String(next));
    if (next !== value) onSave(next);
  }
  return (
    <View className="min-w-32 flex-1 gap-1">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Input
        value={text}
        onChangeText={setText}
        onBlur={save}
        onSubmitEditing={save}
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel={label}
        className="font-mono"
      />
    </View>
  );
}
