import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { ActionMenu } from '@/components/ui/dialog';
import { saveTextFile } from '@/lib/download';
import {
  exportFileName,
  pageToCsv,
  pageToMarkdown,
  pageToPrintHtml,
  type ExportStrings,
  type ExportTask,
} from '@/lib/page-export';
import { canPrint, printHtml, saveHtmlAsPdf } from '@/lib/print';
import { useToast } from '@/providers/toast';

// Exportar a lista (PB9, V3 §6 B, D304): CSV, Markdown, PDF e imprimir. Tudo gerado no aparelho, a
// partir das tarefas que a tela já tem (funciona sem internet).

export function PageExportMenu({
  name,
  tasks,
  onClose,
}: {
  name: string;
  tasks: readonly ExportTask[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeZone: 'UTC' });
  const strings = (): ExportStrings => ({
    code: t('pageExport.code'),
    task: t('pageExport.task'),
    done: t('pageExport.done'),
    due: t('pageExport.due'),
    priority: t('pageExport.priority'),
    labels: t('pageExport.labels'),
    notes: t('pageExport.notes'),
    yes: t('pageExport.yes'),
    generated: t('pageExport.generated', {
      date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(new Date()),
    }),
    progress: t('pageExport.progress', {
      done: tasks.filter((x) => x.status === 'done').length,
      count: tasks.length,
    }),
    date: (iso) => dateFmt.format(new Date(`${iso}T00:00:00Z`)),
  });
  const fail = (err: unknown) =>
    toast({ message: t('pageExport.failed', { message: (err as Error)?.message ?? '' }) });
  const run = (job: () => Promise<unknown>) => {
    onClose();
    job().catch(fail);
  };
  const printable = canPrint();

  return (
    <ActionMenu
      title={t('pageExport.title')}
      onClose={onClose}
      actions={[
        {
          label: t('pageExport.csv'),
          onPress: () =>
            run(() =>
              saveTextFile(exportFileName(name, 'csv'), pageToCsv(tasks, strings()), 'text/csv'),
            ),
        },
        {
          label: t('pageExport.markdown'),
          onPress: () =>
            run(() =>
              saveTextFile(
                exportFileName(name, 'md'),
                pageToMarkdown(name, tasks),
                'text/markdown',
              ),
            ),
        },
        ...(printable
          ? [
              // Na web, o PDF sai pela impressão do navegador ("Salvar como PDF"): um item só
              ...(Platform.OS === 'web'
                ? []
                : [
                    {
                      label: t('pageExport.pdf'),
                      onPress: () =>
                        run(() =>
                          saveHtmlAsPdf(
                            pageToPrintHtml(name, tasks, strings()),
                            exportFileName(name, 'pdf'),
                          ),
                        ),
                    },
                  ]),
              {
                label: t(Platform.OS === 'web' ? 'pageExport.printWeb' : 'pageExport.print'),
                onPress: () => run(() => printHtml(pageToPrintHtml(name, tasks, strings()))),
              },
            ]
          : []),
      ]}
    />
  );
}
