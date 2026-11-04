import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';

// Web Clipper (OB15, D305): a extensão do navegador vai junto com a web (o deploy gera o .zip em
// /questlist-clipper.zip). Só no computador; sem o arquivo (em desenvolvimento), some.
const URL = '/questlist-clipper.zip';

export function ClipperDownload() {
  const { t } = useTranslation();
  const available = useQuery({
    queryKey: ['clipper-zip'],
    enabled: Platform.OS === 'web',
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(URL, { method: 'HEAD', cache: 'no-store' });
      // Sem o arquivo, o servidor da web devolve a própria página (SPA)
      return res.ok && !(res.headers.get('content-type') ?? '').includes('text/html');
    },
  }).data;
  if (Platform.OS !== 'web' || !available) return null;
  return (
    <View testID="clipper-download" className="gap-2">
      <SectionLabel title={t('clipper.extension')} />
      <Text className="text-sm text-ink-muted">{t('clipper.extensionHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="ghost"
          icon={Download}
          label={t('clipper.download')}
          onPress={() => {
            window.location.href = URL;
          }}
        />
        <Button
          variant="ghost"
          label={t('clipper.how')}
          onPress={() =>
            router.push({ pathname: '/ajuda', params: { artigo: 'pastas-projetos-paginas' } })
          }
        />
      </View>
    </View>
  );
}
