import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HtmlView, PdfView } from '@/components/material-view';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { formatBytes } from '@/lib/attachments';
import { materialTitle } from '@/lib/materials';
import { useMaterial } from '@/lib/queries/materials';
import { findFolder, useTree } from '@/lib/queries/tree';

/** Leitor do material: PDF (ES4, D325) ou HTML interativo isolado (ES5, D326) */
export default function MaterialScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const material = useMaterial(id);
  const tree = useTree();
  const m = material.data;
  const folder = m ? findFolder(tree.data, m.folder_id)?.folder : undefined;
  return (
    <Screen size="wide">
      <ScreenHeader
        title={m ? materialTitle(m.name) : t('materials.title')}
        eyebrow={
          m
            ? [
                folder?.name,
                t(m.mime === 'text/html' ? 'materials.kindHtml' : 'materials.kindPdf', {
                  size: formatBytes(m.size ?? 0, i18n.language),
                }),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        back
      />
      {material.isPending ? null : !m || !m.path ? (
        <EmptyState title={t('materials.missing')} />
      ) : (
        <View className="flex-1 pb-4">
          {m.mime === 'text/html' ? (
            <HtmlView path={m.path} name={m.name} />
          ) : (
            <PdfView path={m.path} name={m.name} />
          )}
        </View>
      )}
    </Screen>
  );
}
