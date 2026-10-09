import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GameProfile } from '@/components/game-profile';
import { PrivacySection } from '@/components/privacy-section';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearPrefs } from '@/lib/prefs';
import { useProfile, useUpdateProfile, type Profile } from '@/lib/queries/profile';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { clearQueryCache } from '@/providers/query';
import { useSession } from '@/providers/session';

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function ProfileScreen() {
  const profile = useProfile();
  return (
    <Screen>
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
    await supabase.auth.signOut();
    // O próximo usuário deste aparelho não pode ver o cache do anterior
    clearQueryCache();
    clearPrefs();
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-28">
      <Text className="text-muted-foreground">{session?.user.email}</Text>

      <GameProfile />
      <Button
        variant="outline"
        className="self-start"
        label="🛡️ Clã"
        onPress={() => router.push('/clan')}
      />

      <View className="gap-1">
        <Text className="font-semibold text-foreground">Nome</Text>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={50}
          editable={online}
          accessibilityLabel="Nome"
        />
      </View>

      <View className="gap-1">
        <Text className="font-semibold text-foreground">Fuso horário</Text>
        <Text className="text-sm text-muted-foreground">
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
          <Text className="text-sm text-destructive">
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
        <Text className="text-destructive">Não deu para salvar: {update.error.message}</Text>
      )}
      <Button
        label="Salvar"
        disabled={!changed || !validTimezone || !name.trim() || !online}
        loading={update.isPending}
        onPress={() => update.mutate({ display_name: name.trim(), timezone: timezone.trim() })}
      />

      <View className="mt-6 gap-6 border-t border-border pt-4">
        <PrivacySection />
        <Button variant="outline" label="Sair da conta" onPress={signOut} />
      </View>
    </ScrollView>
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
