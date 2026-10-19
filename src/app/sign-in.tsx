import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LandingFeatures, LandingFooter, LandingHero } from '@/components/landing';
import { SignInForm } from '@/components/sign-in-form';
import { Text } from '@/components/ui/text';
import { isReturningDevice } from '@/lib/prefs';
import { sessionEnded } from '@/lib/session';

type Mode = 'sign-in' | 'sign-up';

/**
 * Entrada (S1, V4 §5; D211): a apresentação do app (recursos com capturas) e o formulário. Em
 * tela larga, o formulário fica fixo ao lado; no celular, no fim da página (os botões do topo
 * levam até ele). Quem já entrou neste aparelho vê o formulário primeiro.
 */
export default function SignInScreen() {
  // Com sessão, o Stack.Protected do _layout troca de tela sozinho
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  // O servidor encerrou a sessão (não foi a pessoa que saiu): diz o porquê (D179)
  const [ended] = useState(sessionEnded);
  const [returning] = useState(isReturningDevice);
  const [mode, setMode] = useState<Mode>('sign-in');
  // Troca de modo pelos botões do topo remonta o formulário já no modo pedido
  const [formKey, setFormKey] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const formY = useRef(0);

  function start(next: Mode) {
    setMode(next);
    setFormKey((k) => k + 1);
    if (!wide) scroll.current?.scrollTo({ y: formY.current, animated: true });
  }

  const notice = ended && (
    <View
      accessibilityRole="alert"
      className="mb-6 w-full max-w-sm rounded border border-line px-4 py-3"
    >
      <Text className="text-sm text-ink">{t('session.ended')}</Text>
    </View>
  );
  const form = (
    <View
      className="items-center py-8"
      onLayout={(e) => {
        formY.current = e.nativeEvent.layout.y;
      }}
    >
      {notice}
      <SignInForm key={formKey} initialMode={mode} />
    </View>
  );

  if (wide)
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="w-full max-w-7xl flex-1 flex-row self-center">
          <ScrollView className="flex-1" contentContainerClassName="px-12">
            <LandingHero onStart={start} />
            <LandingFeatures />
            <LandingFooter />
          </ScrollView>
          <View className="w-[420px] justify-center border-l border-line px-8">{form}</View>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-3xl self-center px-6"
        >
          {(returning || ended) && form}
          <LandingHero onStart={start} />
          <LandingFeatures />
          {!(returning || ended) && form}
          <LandingFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
