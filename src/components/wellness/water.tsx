import { router } from 'expo-router';
import { Bell, Settings2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HealthConsentGate, HealthNotice } from '@/components/health/health-privacy';
import { Button, IconButton } from '@/components/ui/button';
import { PromptDialog } from '@/components/ui/dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useToday } from '@/lib/queries/profile';
import { useWater, useWaterActions } from '@/lib/queries/water';
import {
  dayTotal,
  formatWater,
  goalProgress,
  parseWaterAmount,
  WATER_LIMITS,
  waterWeek,
  weekAverage,
} from '@/lib/water';
import { useToast } from '@/providers/toast';

type Dialog = 'other' | 'settings' | null;

/**
 * Água (SA2, D383) no Bem-estar: toques rápidos (um copo, meio litro, outra quantidade), o total do
 * dia contra a meta, os registros de hoje e a semana. Dado de saúde: só com o consentimento.
 */
export function WaterSection() {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <SectionLabel title={t('water.title')} />
      <HealthConsentGate>
        <WaterBody />
      </HealthConsentGate>
    </View>
  );
}

function WaterBody() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const water = useWater(today);
  const actions = useWaterActions(today);
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const fail = (e: Error) => toast({ message: e.message });
  const data = water.data;
  if (!data) return null;

  const { goal, cup } = data.settings;
  const total = dayTotal(data.logs, today);
  const week = waterWeek(data.logs, today);
  const max = Math.max(goal, ...week.map((d) => d.ml));
  const todayLogs = data.logs.filter((l) => l.day === today).reverse();
  const fmt = (ml: number) => formatWater(ml, i18n.language);
  const drink = (ml: number) => {
    actions.drink(ml).catch(fail);
  };

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="font-serif text-xl text-ink">
          {t('water.today', { total: fmt(total), goal: fmt(goal) })}
        </Text>
        <ProgressBar
          thick
          value={Math.min(1, goalProgress(total, goal))}
          label={t('water.progress', { total: fmt(total), goal: fmt(goal) })}
        />
        <Text className="text-sm text-ink-muted">
          {total >= goal ? t('water.reached') : t('water.left', { left: fmt(goal - total) })}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button label={t('water.cup', { ml: fmt(cup) })} onPress={() => drink(cup)} />
        {cup !== 500 && (
          <Button
            variant="ghost"
            label={t('water.add', { ml: fmt(500) })}
            onPress={() => drink(500)}
          />
        )}
        <Button variant="ghost" label={t('water.other')} onPress={() => setDialog('other')} />
        <IconButton
          icon={Settings2}
          label={t('water.settings')}
          onPress={() => setDialog('settings')}
        />
        <IconButton
          icon={Bell}
          label={t('water.reminder')}
          onPress={() => router.push('/automacoes')}
        />
      </View>

      {todayLogs.length > 0 && (
        <View accessibilityLabel={t('water.todayList')}>
          {todayLogs.map((l) => (
            <View key={l.id} className="min-h-10 flex-row items-center gap-2 border-b border-line">
              <Text className="w-16 text-sm text-ink-muted">
                {new Date(l.logged_at).toLocaleTimeString(i18n.language, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text className="flex-1 text-sm text-ink">{fmt(l.ml)}</Text>
              <IconButton
                icon={X}
                tone="danger"
                label={t('water.remove', { ml: fmt(l.ml) })}
                onPress={() => actions.remove.mutate(l.id, { onError: fail })}
              />
            </View>
          ))}
        </View>
      )}

      <View className="gap-2">
        <Text className="text-sm text-ink-muted">
          {t('water.weekAverage', { avg: fmt(weekAverage(week)) })}
        </Text>
        <View
          className="h-24 flex-row items-end gap-2"
          accessibilityRole="image"
          accessibilityLabel={t('water.chart')}
        >
          {week.map((d) => (
            <View
              key={d.day}
              className="flex-1 items-center gap-1"
              accessibilityLabel={t('water.bar', {
                day: new Date(`${d.day}T12:00:00`).toLocaleDateString(i18n.language, {
                  weekday: 'short',
                }),
                ml: fmt(d.ml),
              })}
            >
              <View className="w-full flex-1 justify-end">
                <View
                  className={d.ml >= goal ? 'rounded-t bg-accent' : 'rounded-t bg-line'}
                  style={{ height: `${max ? Math.max(2, (d.ml / max) * 100) : 2}%` }}
                />
              </View>
              <Text className="text-xs text-ink-muted">
                {new Date(`${d.day}T12:00:00`).toLocaleDateString(i18n.language, {
                  weekday: 'narrow',
                })}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <HealthNotice />

      {dialog === 'other' && (
        <PromptDialog
          title={t('water.otherTitle')}
          fields={[{ key: 'ml', placeholder: t('water.otherPlaceholder'), maxLength: 12 }]}
          validate={(v) => parseWaterAmount(v.ml) !== null}
          confirmLabel={t('water.register')}
          onClose={() => setDialog(null)}
          onConfirm={(v) => {
            const ml = parseWaterAmount(v.ml);
            setDialog(null);
            if (ml) drink(ml);
          }}
        />
      )}
      {dialog === 'settings' && (
        <PromptDialog
          title={t('water.settings')}
          message={t('water.settingsHint')}
          fields={[
            { key: 'goal', placeholder: t('water.goalPlaceholder'), initial: String(goal) },
            { key: 'cup', placeholder: t('water.cupPlaceholder'), initial: String(cup) },
          ]}
          validate={(v) => inRange(v.goal, WATER_LIMITS.goal) && inRange(v.cup, WATER_LIMITS.cup)}
          onClose={() => setDialog(null)}
          onConfirm={(v) => {
            setDialog(null);
            actions.saveSettings.mutate(
              { settings: { goal: Number(v.goal), cup: Number(v.cup) }, saved: data.saved },
              { onError: fail },
            );
          }}
        />
      )}
    </View>
  );
}

const inRange = (text: string, [min, max]: readonly [number, number]) => {
  const n = Number(text);
  return Number.isInteger(n) && n >= min && n <= max;
};
