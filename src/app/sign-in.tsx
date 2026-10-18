import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';
import { Text } from '@/components/ui/text';
import { sessionEnded } from '@/lib/session';

export default function SignInScreen() {
  // Com sessão, o Stack.Protected do _layout troca de tela sozinho
  const { t } = useTranslation();
  // O servidor encerrou a sessão (não foi a pessoa que saiu): diz o porquê (D179)
  const [ended] = useState(sessionEnded);
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center px-6"
      >
        {ended && (
          <View
            accessibilityRole="alert"
            className="mb-6 w-full max-w-sm rounded border border-line px-4 py-3"
          >
            <Text className="text-sm text-ink">{t('session.ended')}</Text>
          </View>
        )}
        <SignInForm />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
