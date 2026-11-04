import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

// Imprimir e salvar em PDF (PB9, D304) no celular: o expo-print usa a impressão do sistema (no
// Android, "Salvar como PDF" também aparece lá) e gera o PDF para o "Compartilhar". Precisa do APK
// novo; sem o módulo, o app avisa em vez de quebrar.

export const canPrint = () => typeof Print.printAsync === 'function';

export async function printHtml(html: string) {
  await Print.printAsync({ html });
}

export async function saveHtmlAsPdf(html: string, name: string) {
  const { uri } = await Print.printToFileAsync({ html });
  // O arquivo sai com nome aleatório: copia com o nome da lista para o Compartilhar mostrar
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  await new File(uri).copy(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle: name });
}
