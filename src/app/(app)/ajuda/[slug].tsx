import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Markdown } from '@/components/markdown';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HELP } from '@/content/help';

/** Um artigo da Ajuda (F1, D145), no idioma do app (português se faltar). */
export default function HelpArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const article =
    (HELP[i18n.language] ?? HELP['pt-BR']).find((a) => a.slug === slug) ??
    HELP['pt-BR'].find((a) => a.slug === slug);
  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 pb-12">
        <ScreenHeader title={article?.title ?? t('help.title')} eyebrow={t('help.title')} back />
        {article ? <Markdown source={article.body} /> : <EmptyState title={t('help.missing')} />}
        <Button
          variant="ghost"
          className="self-start"
          label={t('help.all')}
          onPress={() => router.replace('/ajuda')}
        />
      </ScrollView>
    </Screen>
  );
}
