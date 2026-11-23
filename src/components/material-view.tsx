import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useColorScheme } from 'nativewind';
import { BookOpen } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import pdfLib from '../../assets/pdfjs/pdf.min.txt';
import pdfWorker from '../../assets/pdfjs/pdf.worker.min.txt';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PDF_MIME } from '@/lib/materials';
import { localMaterialFile } from '@/lib/material-cache';
import { parseReaderMessage, pdfReaderHtml } from '@/lib/pdf-reader-html';
import { useColors } from '@/lib/tokens';

/** Copia o pdf.js (assets) para a pasta do leitor; de novo só quando a versão (hash) muda */
async function readerDir() {
  const dir = new Directory(Paths.cache, 'pdf-reader');
  if (!dir.exists) dir.create({ idempotent: true });
  const files: [string, Asset][] = [
    ['pdf.min.js', Asset.fromModule(pdfLib)],
    ['pdf.worker.min.js', Asset.fromModule(pdfWorker)],
  ];
  const version = files.map(([, asset]) => asset.hash ?? asset.name).join(':');
  const marker = new File(dir, 'version.txt');
  if (
    marker.exists &&
    marker.textSync() === version &&
    files.every(([n]) => new File(dir, n).exists)
  )
    return dir;
  for (const [name, asset] of files) {
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('pdf.js');
    const target = new File(dir, name);
    if (target.exists) target.delete();
    new File(asset.localUri).copy(target);
  }
  if (marker.exists) marker.delete();
  marker.create();
  marker.write(version);
  return dir;
}

/**
 * Leitor de PDF no celular (ES7/CD44, D329): o pdf.js numa WebView, com o arquivo no aparelho (abre
 * sem internet depois da primeira vez). Abre na página guardada e avisa a página em que a pessoa
 * está (`onPage`, o onde parei). Se o leitor falhar, fica o botão de abrir no leitor do aparelho.
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
  const { colorScheme } = useColorScheme();
  const colors = useColors();
  const [reader, setReader] = useState<{ uri: string; dir: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // A página só vale ao abrir (mudar depois não recarrega o leitor)
  const startPage = useRef(page ?? 1);
  const dark = colorScheme === 'dark';
  const paper = colors.paper;
  const ink = colors.ink;
  useEffect(() => {
    let alive = true;
    (async () => {
      const [pdf, dir] = await Promise.all([localMaterialFile(path), readerDir()]);
      const html = new File(dir, `reader-${dark ? 'dark' : 'light'}.html`);
      if (html.exists) html.delete();
      html.create();
      html.write(
        pdfReaderHtml({
          pdf: pdf.uri,
          page: startPage.current,
          background: paper,
          ink,
        }),
      );
      if (alive) setReader({ uri: html.uri, dir: dir.uri });
    })().catch((err: Error) => alive && setFailed(err.message || 'erro'));
    return () => {
      alive = false;
    };
  }, [path, dark, paper, ink]);

  return (
    <View className="flex-1 gap-2">
      {reader && !failed && (
        <WebView
          source={{ uri: reader.uri }}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={Paths.cache.uri}
          javaScriptEnabled
          setSupportMultipleWindows={false}
          style={{ flex: 1, minHeight: 480, backgroundColor: 'transparent' }}
          onMessage={(e) => {
            const msg = parseReaderMessage(e.nativeEvent.data);
            if (msg?.type === 'page') onPage?.(msg.page);
            else if (msg?.type === 'error') setFailed(msg.message);
          }}
          testID="pdf-webview"
        />
      )}
      {failed && (
        <Text className="text-sm text-danger">{t('materials.openError', { message: failed })}</Text>
      )}
      {/* Reserva: o leitor de PDF do aparelho */}
      <OpenOnDevice path={path} name={name} html={false} compact={!failed} />
    </View>
  );
}

/** HTML interativo (ES5, D326): no navegador do aparelho, fora do app */
export function HtmlView({ path, name }: { path: string; name: string }) {
  return <OpenOnDevice path={path} name={name} html />;
}

function OpenOnDevice({
  path,
  name,
  html,
  compact,
}: {
  path: string;
  name: string;
  html: boolean;
  /** Só o botão, discreto (embaixo do leitor) */
  compact?: boolean;
}) {
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
    <View className={compact ? 'items-start' : 'items-start gap-3 p-4'}>
      {!compact && (
        <Text className="text-ink-muted">
          {t(html ? 'materials.nativeHtmlHint' : 'materials.nativeHint')}
        </Text>
      )}
      <Button
        variant={compact ? 'ghost' : 'primary'}
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
