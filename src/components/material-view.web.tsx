import { ExternalLink } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { PDF_MIME } from '@/lib/materials';
import { getMaterialBlob } from '@/lib/material-cache';
import { parseReaderMessage, pdfReaderHtml } from '@/lib/pdf-reader-html';
import { useColors } from '@/lib/tokens';

/**
 * Leitor de PDF na web (ES4/CD46, D325): o mesmo pdf.js do celular (`lib/pdf-reader-html`), num
 * quadro `srcdoc` com o arquivo em `blob:` (o endereço do Storage não pode ir num quadro). Não usa o
 * leitor do navegador: o Firefox do Android baixa o PDF e tenta abrir o `file:///` (erro de
 * segurança). Abre na página guardada e avisa a página em que a pessoa está (`onPage`).
 */
export function PdfView({
  path,
  name,
  page,
  onPage,
}: {
  path: string;
  name: string;
  page?: number;
  onPage?: (page: number) => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // A página só vale ao abrir (para pular, quem chama troca a `key`)
  const [startPage] = useState(page ?? 1);
  const report = useRef(onPage);
  useEffect(() => {
    report.current = onPage;
  });
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    (async () => {
      url = URL.createObjectURL(new Blob([await getMaterialBlob(path)], { type: PDF_MIME }));
      if (alive) setSrc(url);
      else URL.revokeObjectURL(url);
    })().catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const data = (e.data as { questlistPdf?: unknown } | null)?.questlistPdf;
      const msg = typeof data === 'string' ? parseReaderMessage(data) : null;
      if (msg?.type === 'page') report.current?.(msg.page);
      else if (msg?.type === 'error') setError(msg.message);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);
  const html = useMemo(
    () =>
      src
        ? pdfReaderHtml({
            pdf: src,
            page: startPage,
            background: colors.paper,
            ink: colors.ink,
            assets: '/pdfjs/',
          })
        : null,
    // O tema entra na página: muda, desenha de novo
    [src, startPage, colors.paper, colors.ink],
  );

  if (error) return <EmptyState title={t('materials.openError', { message: error })} />;
  if (!src || !html)
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
        ref={frame}
        srcDoc={html}
        title={name}
        data-testid="pdf-frame"
        data-start-page={startPage}
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
      const text = await (await getMaterialBlob(path)).text();
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
