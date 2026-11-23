import * as Sharing from 'expo-sharing';
import { BookOpen } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PDF_MIME } from '@/lib/materials';
import { localMaterialFile } from '@/lib/material-cache';

/**
 * Leitor de PDF no celular (ES4, D325): baixa o arquivo e abre no leitor de PDF do aparelho. O
 * leitor dentro do app (pdf.js numa WebView) pede um APK novo e fica para depois.
 */
export function PdfView({ path, name }: { path: string; name: string; page?: number }) {
  return <OpenOnDevice path={path} name={name} html={false} />;
}

/** HTML interativo (ES5, D326): no navegador do aparelho, fora do app */
export function HtmlView({ path, name }: { path: string; name: string }) {
  return <OpenOnDevice path={path} name={name} html />;
}

function OpenOnDevice({ path, name, html }: { path: string; name: string; html: boolean }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'busy' | string>('idle');
  async function open() {
    setState('busy');
    try {
      const file = await localMaterialFile(path);
      await Sharing.shareAsync(
        file.uri,
        html
          ? { mimeType: 'text/html', UTI: 'public.html', dialogTitle: name }
          : { mimeType: PDF_MIME, UTI: 'com.adobe.pdf', dialogTitle: name },
      );
      setState('idle');
    } catch (err) {
      setState((err as Error).message || 'erro');
    }
  }
  return (
    <View className="items-start gap-3 p-4">
      <Text className="text-ink-muted">
        {t(html ? 'materials.nativeHtmlHint' : 'materials.nativeHint')}
      </Text>
      <Button
        icon={BookOpen}
        label={t(html ? 'materials.openHtml' : 'materials.openDevice')}
        loading={state === 'busy'}
        onPress={() => void open()}
      />
      {state !== 'idle' && state !== 'busy' && (
        <Text className="text-sm text-danger">{t('materials.openError', { message: state })}</Text>
      )}
    </View>
  );
}
