import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

// Capturas do app (docs/screenshots, telas do celular cortadas no topo) em assets/landing
const SHOTS = {
  captura: [
    require('../../assets/landing/captura-claro.webp'),
    require('../../assets/landing/captura-escuro.webp'),
  ],
  arvore: [
    require('../../assets/landing/arvore-claro.webp'),
    require('../../assets/landing/arvore-escuro.webp'),
  ],
  projetos: [
    require('../../assets/landing/projetos-claro.webp'),
    require('../../assets/landing/projetos-escuro.webp'),
  ],
  jogo: [
    require('../../assets/landing/jogo-claro.webp'),
    require('../../assets/landing/jogo-escuro.webp'),
  ],
  treino: [
    require('../../assets/landing/treino-claro.webp'),
    require('../../assets/landing/treino-escuro.webp'),
  ],
} as const;

const FEATURES = ['captura', 'arvore', 'projetos', 'jogo', 'treino', 'offline'] as const;
type Feature = (typeof FEATURES)[number];

/** Topo da entrada: marca, a frase do app e os dois caminhos (criar conta ou entrar). */
export function LandingHero({ onStart }: { onStart: (mode: 'sign-up' | 'sign-in') => void }) {
  const { t } = useTranslation();
  return (
    <View className="gap-6 pb-8 pt-12">
      <View className="flex-row items-center gap-3">
        <BrandMark size={40} />
        <Text className="font-serif text-xl text-ink">Questlist</Text>
      </View>
      <Text accessibilityRole="header" className="font-serif text-xl text-ink">
        {t('landing.title')}
      </Text>
      <Text className="text-base text-ink-muted">{t('landing.subtitle')}</Text>
      <View className="flex-row flex-wrap gap-3">
        <Button label={t('landing.start')} onPress={() => onStart('sign-up')} />
        <Button
          variant="ghost"
          label={t('landing.haveAccount')}
          onPress={() => onStart('sign-in')}
        />
      </View>
    </View>
  );
}

/** Recursos com captura de tela, um por linha (a imagem alterna de lado em tela larga). */
export function LandingFeatures() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark' ? 1 : 0;
  return (
    <View className="gap-12 pb-12">
      {FEATURES.map((key: Feature, i) => {
        const shot = key === 'offline' ? null : SHOTS[key][dark];
        return (
          <View
            key={key}
            className={
              i % 2
                ? 'gap-4 md:flex-row-reverse md:items-center md:gap-8'
                : 'gap-4 md:flex-row md:items-center md:gap-8'
            }
          >
            {shot && (
              <View className="self-center overflow-hidden rounded-lg border border-line">
                <Image
                  source={shot}
                  style={{ width: 240, height: 360 }}
                  contentFit="cover"
                  accessibilityLabel={t(
                    `landing.features.${key}.shot` as 'landing.features.captura.shot',
                  )}
                />
              </View>
            )}
            <View className="gap-2 md:flex-1">
              <Text accessibilityRole="header" className="font-serif text-lg text-ink">
                {t(`landing.features.${key}.title` as 'landing.features.captura.title')}
              </Text>
              <Text className="text-base text-ink-muted">
                {t(`landing.features.${key}.text` as 'landing.features.captura.text')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap gap-4 border-t border-line py-6">
      <Link href="/privacidade" asChild>
        <Text accessibilityRole="link" className="text-sm text-ink-muted underline">
          {t('landing.privacy')}
        </Text>
      </Link>
      <Text className="text-sm text-ink-muted">{t('landing.languages')}</Text>
    </View>
  );
}
