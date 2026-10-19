import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react-native';
import { Platform, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up' | 'forgot';

/** Entrar ou criar conta. Com sessão, quem mostra o formulário decide para onde ir. */
export function SignInForm({ initialMode = 'sign-in' }: { initialMode?: Mode }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);

  /** Esqueci minha senha (W1): o link do e-mail abre /nova-senha neste mesmo endereço */
  async function sendReset() {
    setError(null);
    setLoading(true);
    const base =
      Platform.OS === 'web' ? window.location.origin : (process.env.EXPO_PUBLIC_WEB_URL ?? '');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${base}/nova-senha`,
    });
    setLoading(false);
    if (error) setError(translateAuthError(error.message, t));
    // Mesmo sem conta com esse e-mail, a resposta é a mesma (não revela quem tem conta)
    else setSent(true);
  }

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
      <View className="mb-6 flex-row items-center gap-3">
        <BrandMark size={48} />
        <View className="flex-1 gap-1">
          <Text className="font-serif text-xl text-ink">Questlist</Text>
          <Text className="text-sm text-ink-muted">{t('auth.tagline')}</Text>
        </View>
      </View>
      <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {t(
          mode === 'sign-in'
            ? 'auth.signInTitle'
            : mode === 'forgot'
              ? 'auth.forgotTitle'
              : 'auth.signUpTitle',
        )}
      </Text>
      {mode === 'forgot' && (
        <Text className="text-sm text-ink-muted">
          {t(sent ? 'auth.resetSent' : 'auth.forgotHint')}
        </Text>
      )}

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
      {mode !== 'forgot' && (
        <PasswordInput
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword(!showPassword)}
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          onSubmitEditing={submit}
        />
      )}

      {error && <Text className="text-sm text-danger">{error}</Text>}

      {mode === 'forgot' ? (
        <Button
          label={t('auth.sendReset')}
          onPress={sendReset}
          loading={loading}
          disabled={!email.includes('@') || sent}
        />
      ) : (
        <Button
          label={t(mode === 'sign-in' ? 'auth.signIn' : 'auth.signUp')}
          onPress={submit}
          loading={loading}
          disabled={!email || password.length < 6}
        />
      )}
      {mode === 'sign-in' && (
        <Button
          variant="ghost"
          label={t('auth.forgot')}
          onPress={() => {
            setMode('forgot');
            setError(null);
            setSent(false);
          }}
        />
      )}
      <Button
        variant="ghost"
        label={t(
          mode === 'sign-up'
            ? 'auth.haveAccount'
            : mode === 'forgot'
              ? 'auth.backToSignIn'
              : 'auth.noAccount',
        )}
        onPress={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          setError(null);
        }}
      />
    </View>
  );
}

/** Campo de senha com o olhinho de mostrar/esconder (W1) */
export function PasswordInput({
  visible,
  onToggle,
  ...props
}: React.ComponentProps<typeof Input> & { visible: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="justify-center">
      <Input {...props} secureTextEntry={!visible} className="pr-12" />
      <View className="absolute right-0">
        <IconButton
          icon={visible ? EyeOff : Eye}
          label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          onPress={onToggle}
        />
      </View>
    </View>
  );
}

function translateAuthError(message: string, t: TFunction) {
  if (/invalid login credentials/i.test(message)) return t('auth.wrong');
  if (/already registered/i.test(message)) return t('auth.taken');
  if (/password should be at least/i.test(message)) return t('auth.short');
  if (/rate limit|too many/i.test(message)) return t('auth.rateLimit');
  return message;
}
