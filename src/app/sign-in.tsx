import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/sign-in-form';

export default function SignInScreen() {
  // Com sessão, o Stack.Protected do _layout troca de tela sozinho
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center px-6"
      >
        <SignInForm />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
