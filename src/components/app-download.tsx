import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatBytes } from '@/lib/attachments';

// App para Android fora da loja (U7, D155): o `npm run apk` publica o APK e um apk.json no mesmo
// endereço do app. Na web, o Perfil oferece o download; no app instalado, avisa quando há versão
// mais nova (o build guarda o próprio número em EXPO_PUBLIC_APK_CODE). No iPhone, nada.

type ApkInfo = {
  version: string;
  versionCode: number;
  commit: string;
  size: number;
  builtAt: string;
};

const BASE = Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_WEB_URL ?? '');
const CURRENT = Number(process.env.EXPO_PUBLIC_APK_CODE ?? 0);

export function useApkInfo() {
  return useQuery({
    queryKey: ['apk-info'],
    enabled: Platform.OS !== 'ios' && (Platform.OS === 'web' || !!BASE),
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ApkInfo | null> => {
      const res = await fetch(`${BASE}/downloads/apk.json`, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as ApkInfo;
    },
  });
}

export function AppDownload() {
  const { t, i18n } = useTranslation();
  const info = useApkInfo().data;
  if (!info) return null;
  const url = `${BASE}/downloads/questlist.apk`;
  const date = new Date(info.builtAt).toLocaleDateString(i18n.language);
  const details = t('apk.details', {
    version: `${info.version} (${info.commit})`,
    size: formatBytes(info.size, i18n.language),
    date,
  });

  if (Platform.OS === 'android') {
    const newer = info.versionCode > CURRENT;
    return (
      <View className="gap-2">
        <Text className="text-sm text-ink-muted">
          {newer ? t('apk.update') : t('apk.upToDate')} {details}
        </Text>
        {newer && (
          <Button
            icon={Download}
            label={t('apk.downloadUpdate')}
            className="self-start"
            onPress={() => Linking.openURL(url)}
          />
        )}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-sm text-ink-muted">{details}</Text>
      <Button
        icon={Download}
        label={t('apk.download')}
        className="self-start"
        onPress={() => {
          window.location.href = url;
        }}
      />
      <Text className="text-xs text-ink-muted">{t('apk.hint')}</Text>
    </View>
  );
}
