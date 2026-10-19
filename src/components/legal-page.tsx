import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { legalDoc, type LegalDoc } from '@/content/legal';

/** Termos de uso ou política de privacidade (V5 §4), no idioma do app. Páginas públicas. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { t, i18n } = useTranslation();
  const content = legalDoc(doc, i18n.language);
  const other: LegalDoc = doc === 'terms' ? 'privacy' : 'terms';
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="w-full max-w-2xl self-center gap-4 px-6 py-8">
        <Text accessibilityRole="header" className="font-serif text-xl text-ink">
          {content.title}
        </Text>
        <Text className="text-sm text-ink-muted">Questlist · {content.updated}</Text>
        {content.sections.map((section) => (
          <View key={section.title} className="gap-1">
            <Text className="text-lg font-semibold text-ink">{section.title}</Text>
            <Text className="text-base text-ink">{section.body}</Text>
          </View>
        ))}
        <View className="flex-row flex-wrap gap-2 pt-4">
          <Button
            variant="ghost"
            label={legalDoc(other, i18n.language).title}
            onPress={() => router.replace(other === 'terms' ? '/termos' : '/privacidade')}
          />
          <Button
            variant="ghost"
            label={t('legal.backToApp')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
