import { ExternalLink } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { PDF_MIME } from '@/lib/materials';
import { materialUrl } from '@/lib/queries/materials';

/**
 * Leitor de PDF na web (ES4, D325): o do próprio navegador, num quadro da tela (busca, zoom,
 * páginas). O arquivo vem do Storage e vira um endereço `blob:` (o endereço do Storage não pode
 * ir num quadro: as respostas do app proíbem ser emolduradas).
 */
export function PdfView({ path, name }: { path: string; name: string }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    (async () => {
      const res = await fetch(await materialUrl(path));
      if (!res.ok) throw new Error(String(res.status));
      url = URL.createObjectURL(new Blob([await res.blob()], { type: PDF_MIME }));
      if (alive) setSrc(url);
      else URL.revokeObjectURL(url);
    })().catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (error) return <EmptyState title={t('materials.openError', { message: error })} />;
  if (!src)
    return (
      <Text className="p-4 text-sm text-ink-muted" accessibilityLiveRegion="polite">
        {t('materials.loading')}
      </Text>
    );
  return (
    <View className="flex-1 gap-2">
      <View className="flex-row justify-end">
        <Button
          variant="ghost"
          icon={ExternalLink}
          label={t('materials.newTab')}
          onPress={() => window.open(src, '_blank', 'noopener')}
        />
      </View>
      <iframe
        src={src}
        title={name}
        data-testid="pdf-frame"
        style={{ flex: 1, width: '100%', minHeight: '70vh', border: 0, borderRadius: 4 }}
      />
    </View>
  );
}

/**
 * HTML interativo (ES5, D326): num quadro **isolado**. `sandbox="allow-scripts"` sem
 * `allow-same-origin` dá origem nula ao quadro: o script do simulador roda, mas não alcança a
 * sessão, os cookies, o armazenamento nem o Supabase do app. O texto vem pelo `srcdoc` (nunca por
 * um endereço do app).
 */
export function HtmlView({ path, name }: { path: string; name: string }) {
  const { t } = useTranslation();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(await materialUrl(path));
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      if (alive) setHtml(text);
    })().catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [path]);

  if (error) return <EmptyState title={t('materials.openError', { message: error })} />;
  if (html === null)
    return (
      <Text className="p-4 text-sm text-ink-muted" accessibilityLiveRegion="polite">
        {t('materials.htmlLoading')}
      </Text>
    );
  return (
    <View className="flex-1 gap-2">
      <Text className="text-xs text-ink-muted">{t('materials.htmlIsolated')}</Text>
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title={name}
        data-testid="html-frame"
        style={{
          flex: 1,
          width: '100%',
          minHeight: '75vh',
          border: 0,
          borderRadius: 4,
          background: 'white',
        }}
      />
    </View>
  );
}
