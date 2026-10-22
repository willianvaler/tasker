import { router } from 'expo-router';
import { LogOut, RefreshCw, Timer, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { GameLevelSettings } from '@/components/game-profile';
import { LanguageChooser, PanelModeChooser, ThemeChooser } from '@/components/preference-choosers';
import { AppDownload, useApkInfo } from '@/components/app-download';
import { PrivacySection } from '@/components/privacy-section';
import { TimerAlertSetting } from '@/components/timer-alert-setting';
import { PushSetting } from '@/components/push-setting';
import { Screen, ScreenScroll } from '@/components/screen';
import { GymPrefsSettings } from '@/components/gym/gym-prefs';
import { GymToggle, SidebarSettings } from '@/components/sidebar-settings';
import { TabBarSettings } from '@/components/tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { useProfile, useUpdateProfile, type Profile } from '@/lib/queries/profile';
import { signOutHere } from '@/lib/sign-out';
import { useIsOnline } from '@/providers/online';
import { useSession } from '@/providers/session';

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Configurações (D257): só ajustes. Antes era o Perfil, que misturava ajustes, atalhos para outras
// telas (Projetos, Amigos, Times, Pomodoro, Lixeira) e o painel do jogo; os atalhos foram para o
// Mais e para Pessoas, e o jogo para a tela Jogo.
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const profile = useProfile();
  return (
    <Screen size="wide">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <ScreenHeader back title={t('settings.title')} eyebrow={session?.user.email} />
        {profile.data ? <ProfileForm key={profile.data.id} profile={profile.data} /> : null}
      </ScreenScroll>
    </Screen>
  );
}

// Conta, aparência, recursos e navegação numa coluna; avisos, foco, dados e o app na outra (no
// computador). Grupos separados por espaço e rótulo, sem caixas.
function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const apk = useApkInfo();
  const online = useIsOnline();
  const [name, setName] = useState(profile.display_name);
  const [timezone, setTimezone] = useState(profile.timezone);

  const changed = name.trim() !== profile.display_name || timezone.trim() !== profile.timezone;
  const validTimezone = isValidTimezone(timezone.trim());


  const accountGroups = (
    <>
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
        <PanelModeChooser />
      </Group>

      <Group title={t('settings.resources')}>
        <Text className="text-sm text-ink-muted">{t('settings.resourcesHint')}</Text>
        <GymToggle />
        <GameLevelSettings />
      </Group>

      <Group title={t('settings.navigation')}>
        <TabBarSettings />
        <Text className="text-sm font-semibold text-ink">{t('sidebarPrefs.title')}</Text>
        <SidebarSettings />
      </Group>

      {profile.gym_enabled === true && (
        <Group title={t('diary.prefsTitle')}>
          <GymPrefsSettings />
        </Group>
      )}
    </>
  );
  const dataGroups = (
    <>
      <Group title={t('profile.notifications')}>
        <PushSetting />
        <TimerAlertSetting />
      </Group>

      {Platform.OS !== 'ios' && !!apk.data && (
        <Group title={t('settings.about')}>
          <AppDownload />
        </Group>
      )}

      <Group title={t('settings.focus')}>
        <Button
          variant="ghost"
          icon={Timer}
          className="self-start"
          label={t('pomodoro.openSettings')}
          onPress={() => router.push('/pomodoro')}
        />
      </Group>

      <Group title={t('settings.data')}>
        <View className="flex-row flex-wrap gap-1">
          <Button
            destructive
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
          onPress={signOutHere}
        />
      </View>
    </>
  );
  return (
    <View className="gap-8 lg:flex-row lg:items-start lg:gap-12">
      <View className="gap-2 lg:flex-1">{accountGroups}</View>
      <View className="gap-2 lg:flex-1">{dataGroups}</View>
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

function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone.length > 0;
  } catch {
    return false;
  }
}
