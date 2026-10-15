import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordInput } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session';

// Nova senha (W1): o link do e-mail de "Esqueci minha senha" cai aqui já com uma sessão de
// recuperação (o supabase-js lê o endereço). Pública, como o convite: fora do Stack.Protected.
export default function NewPasswordScreen() {
  const { t } = useTranslation();
  const { session, isLoading } = useSession();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (password !== repeat) return setError(t('auth.mismatch'));
    setError(null);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(error.message);
    router.replace('/');
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center px-6"
      >
        <View className="w-full max-w-sm gap-3">
          <Text accessibilityRole="header" className="font-serif text-xl text-ink">
            {t('auth.newPasswordTitle')}
          </Text>
          {isLoading ? null : !session ? (
            <>
              <Text className="text-sm text-ink-muted">{t('auth.resetExpired')}</Text>
              <Button label={t('auth.backToSignIn')} onPress={() => router.replace('/sign-in')} />
            </>
          ) : (
            <>
              <Text className="text-sm text-ink-muted">
                {t('auth.newPasswordHint', { email: session.user.email ?? '' })}
              </Text>
              <PasswordInput
                placeholder={t('auth.newPassword')}
                value={password}
                onChangeText={setPassword}
                visible={visible}
                onToggle={() => setVisible(!visible)}
                autoComplete="new-password"
              />
              <PasswordInput
                placeholder={t('auth.repeatPassword')}
                value={repeat}
                onChangeText={setRepeat}
                visible={visible}
                onToggle={() => setVisible(!visible)}
                autoComplete="new-password"
                onSubmitEditing={save}
              />
              {error && <Text className="text-sm text-danger">{error}</Text>}
              <Button
                label={t('auth.saveNewPassword')}
                onPress={save}
                loading={saving}
                disabled={password.length < 6 || !repeat}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
