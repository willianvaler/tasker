import { router } from 'expo-router';
import { useState } from 'react';
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
  const profile = useProfile();
  return (
    <Screen size="wide">
      <ScreenHeader title="Perfil" />
      {profile.data ? <ProfileForm key={profile.data.id} profile={profile.data} /> : null}
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { session } = useSession();
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
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
      {/* Computador: conta à esquerda, jogo e conquistas à direita (D67) */}
      <View className="gap-8 lg:flex-row-reverse lg:items-start">
        <View className="gap-4 lg:flex-[3]">
          <GameProfile />
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="ghost"
              label="🧙 Personagem"
              onPress={() => router.push('/character')}
            />
            <Button variant="ghost" label="🛒 Loja" onPress={() => router.push('/shop')} />
            <Button variant="ghost" label="🛡️ Clã" onPress={() => router.push('/clan')} />
          </View>
        </View>
        <View className="gap-4 lg:flex-[2]">
          <Text className="text-ink-muted">{session?.user.email}</Text>

          <ThemeChooser />

          <LanguageChooser />

          <PushSetting />

          <View className="gap-1">
            <Text className="font-semibold text-ink">Nome</Text>
            <Input
              value={name}
              onChangeText={setName}
              maxLength={50}
              editable={online}
              accessibilityLabel="Nome"
            />
          </View>

          <View className="gap-1">
            <Text className="font-semibold text-ink">Fuso horário</Text>
            <Text className="text-sm text-ink-muted">
              Define quando o dia vira para &quot;Hoje&quot; e &quot;Atrasadas&quot;.
            </Text>
            <Input
              value={timezone}
              onChangeText={setTimezone}
              autoCapitalize="none"
              editable={online}
              accessibilityLabel="Fuso horário"
            />
            {!validTimezone && (
              <Text className="text-sm text-danger">
                Fuso desconhecido (ex.: America/Sao_Paulo).
              </Text>
            )}
            {deviceTimezone && deviceTimezone !== timezone && (
              <Button
                variant="ghost"
                label={`Usar o do aparelho (${deviceTimezone})`}
                onPress={() => setTimezone(deviceTimezone)}
              />
            )}
          </View>

          {update.error && (
            <Text className="text-danger">Não deu para salvar: {update.error.message}</Text>
          )}
          <Button
            label="Salvar"
            disabled={!changed || !validTimezone || !name.trim() || !online}
            loading={update.isPending}
            onPress={() => update.mutate({ display_name: name.trim(), timezone: timezone.trim() })}
          />

          <View className="mt-6 gap-6 border-t border-line pt-4">
            <PrivacySection />
            <Button variant="ghost" label="Sair da conta" onPress={signOut} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: '☀️ Claro' },
  { value: 'dark', label: '🌙 Escuro' },
];

/** Tema do aparelho (D55): "Sistema" segue o claro/escuro do celular ou do computador. */
function ThemeChooser() {
  const { preference, setPreference } = useThemePreference();
  return (
    <View className="gap-1">
      <Text className="font-semibold text-ink">Aparência</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {THEMES.map((t) => (
          <Chip
            key={t.value}
            role="radio"
            label={t.label}
            selected={preference === t.value}
            onPress={() => setPreference(t.value)}
          />
        ))}
      </View>
    </View>
  );
}

const LANGUAGE_OPTIONS: LocalePreference[] = ['system', ...LOCALES];

/** Idioma (V2 §11): muda na hora e vai para o perfil, valendo nos outros aparelhos. */
function LanguageChooser() {
  const { t } = useTranslation();
  const { preference, choose } = useLocalePreference();
  return (
    <View className="gap-1">
      <Text className="font-semibold text-ink">{t('language.label')}</Text>
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
