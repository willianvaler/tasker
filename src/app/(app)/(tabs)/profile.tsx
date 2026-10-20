import { router } from 'expo-router';
import {
  Backpack,
  FolderKanban,
  LogOut,
  RefreshCw,
  Shield,
  ShoppingBag,
  Swords,
  Timer,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, useWindowDimensions, View } from 'react-native';

import { GameProfile } from '@/components/game-profile';
import { LanguageChooser, PanelModeChooser, ThemeChooser } from '@/components/preference-choosers';
import { AppDownload, useApkInfo } from '@/components/app-download';
import { PrivacySection } from '@/components/privacy-section';
import { TimerAlertSetting } from '@/components/timer-alert-setting';
import { PushSetting } from '@/components/push-setting';
import { Screen, ScreenScroll } from '@/components/screen';
import { SidebarSettings } from '@/components/sidebar-settings';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { clearPrefs } from '@/lib/prefs';
import { disablePush } from '@/lib/push';
import { useProfile, useUpdateProfile, type Profile } from '@/lib/queries/profile';
import { signOut as endSession } from '@/lib/session';
import { useIsOnline } from '@/providers/online';
import { clearQueryCache } from '@/providers/query';
import { useSession } from '@/providers/session';

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const profile = useProfile();
  return (
    <Screen size="wide">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
        <ScreenHeader title={t('profile.title')} eyebrow={session?.user.email} />
        {profile.data ? <ProfileForm key={profile.data.id} profile={profile.data} /> : null}
      </ScreenScroll>
    </Screen>
  );
}

// Configurações: conta, aparência, idioma, avisos e dados à esquerda; o jogo à direita
// no computador. Grupos separados por espaço e rótulo, sem caixas.
function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const apk = useApkInfo();
  const online = useIsOnline();
  const [name, setName] = useState(profile.display_name);
  const [timezone, setTimezone] = useState(profile.timezone);

  const changed = name.trim() !== profile.display_name || timezone.trim() !== profile.timezone;
  const validTimezone = isValidTimezone(timezone.trim());

  async function signOut() {
    // O próximo a usar este aparelho não recebe os avisos de quem saiu
    await disablePush().catch(() => {});
    await endSession();
    // O próximo usuário deste aparelho não pode ver o cache do anterior
    clearQueryCache();
    clearPrefs();
  }

  // Monitor largo (D214): conta e aparência | avisos e dados | jogo, em três colunas
  const three = useWindowDimensions().width >= 1600;
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

      <Group title={t('sidebarPrefs.title')}>
        <SidebarSettings />
      </Group>
    </>
  );
  const dataGroups = (
    <>
      <Group title={t('profile.notifications')}>
        <PushSetting />
        <TimerAlertSetting />
      </Group>

      {Platform.OS !== 'ios' && !!apk.data && (
        <Group title={t('apk.title')}>
          <AppDownload />
        </Group>
      )}

      {/* W2: projetos e times têm configuração própria (Times saiu do bloco do jogo) */}
      <Group title={t('profile.projectsGroup')}>
        <View className="flex-row flex-wrap gap-1">
          <Button
            variant="ghost"
            icon={FolderKanban}
            label={t('projectsHub.link')}
            onPress={() => router.push('/projetos')}
          />
          <Button
            variant="ghost"
            icon={UserPlus}
            label={t('nav.friends')}
            onPress={() => router.push('/amigos')}
          />
          <Button
            variant="ghost"
            icon={Users}
            label={t('nav.teams')}
            onPress={() => router.push('/teams')}
          />
        </View>
      </Group>

      <Group title={t('pomodoro.settings')}>
        <Button
          variant="ghost"
          icon={Timer}
          className="self-start"
          label={t('pomodoro.openSettings')}
          onPress={() => router.push('/pomodoro')}
        />
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
    </>
  );
  const gameGroups = (
    <>
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
            icon={Backpack}
            label={t('inventory.open')}
            onPress={() => router.push('/inventario')}
          />
          <Button
            variant="ghost"
            icon={Trophy}
            label={t('achievements.title')}
            onPress={() => router.push('/conquistas')}
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
    </>
  );

  return three ? (
    <View className="flex-row items-start gap-12">
      <View className="flex-1 gap-2">{accountGroups}</View>
      <View className="flex-1 gap-2">{dataGroups}</View>
      <View className="flex-1 gap-2">{gameGroups}</View>
    </View>
  ) : (
    <View className="gap-8 lg:flex-row lg:items-start lg:gap-12">
      <View className="gap-2 lg:flex-1">
        {accountGroups}
        {dataGroups}
      </View>
      <View className="gap-2 lg:flex-1">{gameGroups}</View>
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
