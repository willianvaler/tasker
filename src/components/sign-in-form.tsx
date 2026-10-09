import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up';

/** Entrar ou criar conta. Com sessão, quem mostra o formulário decide para onde ir. */
export function SignInForm({ initialMode = 'sign-in' }: { initialMode?: Mode }) {
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
    if (error) setError(translateAuthError(error.message));
  }

  return (
    <View className="w-full max-w-sm gap-3">
      <Text className="mb-2 text-center text-3xl font-bold text-foreground">Questlist</Text>
      <Text className="mb-4 text-center text-muted-foreground">
        {mode === 'sign-in' ? 'Entre na sua conta' : 'Crie sua conta'}
      </Text>

      {mode === 'sign-up' && (
        <Input placeholder="Seu nome" value={name} onChangeText={setName} autoComplete="name" />
      )}
      <Input
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <Input
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        onSubmitEditing={submit}
      />

      {error && <Text className="text-destructive">{error}</Text>}

      <Button
        label={mode === 'sign-in' ? 'Entrar' : 'Criar conta'}
        onPress={submit}
        loading={loading}
        disabled={!email || password.length < 6}
      />
      <Button
        variant="ghost"
        label={mode === 'sign-in' ? 'Não tenho conta' : 'Já tenho conta'}
        onPress={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          setError(null);
        }}
      />
    </View>
  );
}

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(message)) return 'Esse e-mail já tem conta. Tente entrar.';
  if (/password should be at least/i.test(message))
    return 'A senha precisa de pelo menos 6 caracteres.';
  return message;
}
