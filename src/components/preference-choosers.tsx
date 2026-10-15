import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { LOCALES, type LocalePreference } from '@/i18n/locale';
import { useLocalePreference } from '@/i18n/use-locale';
import { getPanelMode, setPanelMode, type PanelMode, type ThemePreference } from '@/lib/prefs';
import { useThemePreference } from '@/providers/theme';

// Preferências do aparelho usadas no Perfil e no assistente de primeiro uso (U4): tema, idioma e
// o painel da tarefa simples/completo.

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      {hint && <Text className="text-sm text-ink-muted">{hint}</Text>}
      {children}
    </View>
  );
}

const THEMES = [
  { value: 'system', label: 'profile.themeSystem' },
  { value: 'light', label: 'profile.themeLight' },
  { value: 'dark', label: 'profile.themeDark' },
] as const satisfies readonly { value: ThemePreference; label: string }[];

/** Tema do aparelho: "Sistema" segue o claro/escuro do celular ou do computador. */
export function ThemeChooser() {
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();
  return (
    <Field label={t('profile.theme')}>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {THEMES.map((theme) => (
          <Chip
            key={theme.value}
            role="radio"
            label={t(theme.label)}
            selected={preference === theme.value}
            onPress={() => setPreference(theme.value)}
          />
        ))}
      </View>
    </Field>
  );
}

const LANGUAGE_OPTIONS: LocalePreference[] = ['system', ...LOCALES];

/** Idioma: muda na hora e vai para o perfil, valendo nos outros aparelhos. */
export function LanguageChooser() {
  const { t } = useTranslation();
  const { preference, choose } = useLocalePreference();
  return (
    <Field label={t('language.label')}>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {LANGUAGE_OPTIONS.map((value) => (
          <Chip
            key={value}
            role="radio"
            label={t(`language.${value}`)}
            selected={preference === value}
            onPress={() => choose(value)}
          />
        ))}
      </View>
    </Field>
  );
}

/** Painel da tarefa simples ou completo (U2, D158) */
export function PanelModeChooser() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<PanelMode>(getPanelMode);
  return (
    <Field label={t('panelMode.title')} hint={t(`panelMode.${mode}Hint`)}>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {(['simple', 'full'] as const).map((value) => (
          <Chip
            key={value}
            role="radio"
            label={t(`panelMode.${value}`)}
            selected={mode === value}
            onPress={() => {
              setPanelMode(value);
              setMode(value);
            }}
          />
        ))}
      </View>
    </Field>
  );
}
