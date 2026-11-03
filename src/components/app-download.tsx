import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Download, Watch } from 'lucide-react-native';
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
// O app da Google Play só se atualiza pela loja (política da Play): sem APK por fora
const FROM_STORE = Platform.OS === 'android' && process.env.EXPO_PUBLIC_STORE === 'play';

export function useApkInfo() {
  return useQuery({
    queryKey: ['apk-info'],
    enabled: Platform.OS !== 'ios' && !FROM_STORE && (Platform.OS === 'web' || !!BASE),
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<ApkInfo | null> => {
      const res = await fetch(`${BASE}/downloads/apk.json`, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as ApkInfo;
    },
  });
}

/**
 * App do relógio (Wear OS, D287): o APK fica ao lado do do celular. O relógio não instala pelo
 * navegador; a Ajuda ensina a mandar do celular para o relógio.
 */
function WearDownload() {
  const { t, i18n } = useTranslation();
  const url = `${BASE}/downloads/questlist-wear.apk`;
  const size = useQuery({
    queryKey: ['wear-apk-size'],
    enabled: Platform.OS === 'web' || !!BASE,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<number | null> => {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      // Sem o arquivo, o servidor da web devolve a própria página (SPA): não é o APK
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null;
      return Number(res.headers.get('content-length') ?? 0) || 0;
    },
  }).data;
  if (size === null || size === undefined) return null;
  return (
    <View testID="wear-download" className="gap-2 border-t border-line pt-3">
      <Text className="text-sm font-semibold text-ink">{t('apk.wearTitle')}</Text>
      <Text className="text-sm text-ink-muted">
        {t('apk.wearHint')}
        {size ? ` (${formatBytes(size, i18n.language)})` : ''}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          icon={Watch}
          label={t('apk.wearDownload')}
          onPress={() => {
            if (Platform.OS === 'web') window.location.href = url;
            else void Linking.openURL(url);
          }}
        />
        <Button
          variant="ghost"
          label={t('apk.wearHow')}
          onPress={() =>
            router.push({ pathname: '/ajuda', params: { artigo: 'repeticoes-descanso' } })
          }
        />
      </View>
    </View>
  );
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
        <WearDownload />
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
      <WearDownload />
    </View>
  );
}
