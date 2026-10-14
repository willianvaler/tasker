import { router } from 'expo-router';
import { LogOut, RefreshCw, Shield, ShoppingBag, Swords, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { GameProfile } from '@/components/game-profile';
import { PrivacySection } from '@/components/privacy-section';
import { PushSetting } from '@/components/push-setting';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { LOCALES, type LocalePreference } from '@/i18n/locale';
import { useLocalePreference } from '@/i18n/use-locale';
import { clearPrefs, type ThemePreference } from '@/lib/prefs';
import { disablePush } from '@/lib/push';
import { useProfile, useUpdateProfile, type Profile } from '@/lib/queries/profile';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { clearQueryCache } from '@/providers/query';
import { useSession } from '@/providers/session';
import { useThemePreference } from '@/providers/theme';

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const profile = useProfile();
  return (
    <Screen size="wide">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <View className="w-full max-w-[1120px] self-center">
          <ScreenHeader title={t('profile.title')} eyebrow={session?.user.email} />
          {profile.data ? <ProfileForm key={profile.data.id} profile={profile.data} /> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

// Configurações: conta, aparência, idioma, avisos e dados à esquerda; o jogo à direita
// no computador. Grupos separados por espaço e rótulo, sem caixas.
function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const online = useIsOnline();
  const [name, setName] = useState(profile.display_name);
  const [timezone, setTimezone] = useState(profile.timezone);

  const changed = name.trim() !== profile.display_name || timezone.trim() !== profile.timezone;
  const validTimezone = isValidTimezone(timezone.trim());

  async function signOut() {
    // O próximo a usar este aparelho não recebe os avisos de quem saiu
    await disablePush().catch(() => {});
    await supabase.auth.signOut();
    // O próximo usuário deste aparelho não pode ver o cache do anterior
    clearQueryCache();
    clearPrefs();
  }

  return (
    <View className="gap-8 lg:flex-row lg:items-start lg:gap-12">
      <View className="gap-2 lg:flex-1">
        <Group title={t('profile.account')}>
          <Field label={t('profile.name')}>
            <Input
              value={name}
              onChangeText={setName}
              maxLength={50}
              editable={online}
              accessibilityLabel={t('profile.name')}
            />
          </Field>
          <Field label={t('profile.timezone')} hint={t('profile.timezoneHint')}>
            <Input
              value={timezone}
              onChangeText={setTimezone}
              autoCapitalize="none"
              editable={online}
              accessibilityLabel={t('profile.timezone')}
              className="font-mono"
            />
            {!validTimezone && (
              <Text className="text-sm text-danger">{t('profile.timezoneInvalid')}</Text>
            )}
            {deviceTimezone && deviceTimezone !== timezone && (
              <Button
                variant="ghost"
                className="self-start"
                label={t('profile.useDeviceTimezone', { tz: deviceTimezone })}
                onPress={() => setTimezone(deviceTimezone)}
              />
            )}
          </Field>
          {update.error && (
            <Text className="text-sm text-danger">
              {t('profile.saveError', { message: update.error.message })}
            </Text>
          )}
          <Button
            label={t('common.save')}
            className="self-start"
            disabled={!changed || !validTimezone || !name.trim() || !online}
            loading={update.isPending}
            onPress={() => update.mutate({ display_name: name.trim(), timezone: timezone.trim() })}
          />
        </Group>

        <Group title={t('profile.appearance')}>
          <ThemeChooser />
          <LanguageChooser />
        </Group>

        <Group title={t('profile.notifications')}>
          <PushSetting />
        </Group>

        <Group title={t('privacy.title')}>
          <View className="flex-row flex-wrap gap-1">
            <Button
              variant="ghost"
              icon={Trash2}
              label={t('trash.link')}
              onPress={() => router.push('/lixeira')}
            />
            <Button
              variant="ghost"
              icon={RefreshCw}
              label={t('sync.title')}
              onPress={() => router.push('/sync')}
            />
          </View>
          <PrivacySection />
        </Group>

        <View className="pt-6">
          <Button
            variant="ghost"
            icon={LogOut}
            className="self-start"
            label={t('profile.signOut')}
            onPress={signOut}
          />
        </View>
      </View>

      <View className="gap-2 lg:flex-1">
        <Group title={t('profile.game')}>
          <View className="flex-row flex-wrap gap-1">
            <Button
              variant="ghost"
              icon={Swords}
              label={t('nav.character')}
              onPress={() => router.push('/character')}
            />
            <Button
              variant="ghost"
              icon={ShoppingBag}
              label={t('nav.shop')}
              onPress={() => router.push('/shop')}
            />
            <Button
              variant="ghost"
              icon={Shield}
              label={t('nav.clan')}
              onPress={() => router.push('/clan')}
            />
          </View>
          <GameProfile />
        </Group>
      </View>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-4">
      <SectionLabel title={title} />
      {children}
    </View>
  );
}

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
function ThemeChooser() {
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
function LanguageChooser() {
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

function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone.length > 0;
  } catch {
    return false;
  }
}
