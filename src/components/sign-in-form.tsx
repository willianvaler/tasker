import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up';

/** Entrar ou criar conta. Com sessão, quem mostra o formulário decide para onde ir. */
export function SignInForm({ initialMode = 'sign-in' }: { initialMode?: Mode }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    const { error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { display_name: name.trim() } },
          });
    setLoading(false);
    // Com sessão, a tela de fora reage (login: o Stack.Protected; convite: mostra "Participar")
    if (error) setError(translateAuthError(error.message, t));
  }

  return (
    <View className="w-full max-w-sm gap-3">
      <View className="mb-6 gap-1">
        <Text className="font-serif text-xl text-ink">Questlist</Text>
        <Text className="text-sm text-ink-muted">{t('auth.tagline')}</Text>
      </View>
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t(mode === 'sign-in' ? 'auth.signInTitle' : 'auth.signUpTitle')}
      </Text>

      {mode === 'sign-up' && (
        <Input
          placeholder={t('auth.name')}
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
      )}
      <Input
        placeholder={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <Input
        placeholder={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        onSubmitEditing={submit}
      />

      {error && <Text className="text-sm text-danger">{error}</Text>}

      <Button
        label={t(mode === 'sign-in' ? 'auth.signIn' : 'auth.signUp')}
        onPress={submit}
        loading={loading}
        disabled={!email || password.length < 6}
      />
      <Button
        variant="ghost"
        label={t(mode === 'sign-in' ? 'auth.noAccount' : 'auth.haveAccount')}
        onPress={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          setError(null);
        }}
      />
    </View>
  );
}

function translateAuthError(message: string, t: TFunction) {
  if (/invalid login credentials/i.test(message)) return t('auth.wrong');
  if (/already registered/i.test(message)) return t('auth.taken');
  if (/password should be at least/i.test(message)) return t('auth.short');
  return message;
}
