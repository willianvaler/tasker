import { useTranslation } from 'react-i18next';

import { HomeMaintenance } from '@/components/home/maintenance';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';

// Casa (ESCOPO_V15 §4, CS1, D365): equipamentos e manutenção. Em Mais e no Ctrl+K.
export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen size="medium">
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="gap-8 pb-clear">
        <ScreenHeader back help="casa" title={t('casa.title')} />
        <HomeMaintenance />
      </ScreenScroll>
    </Screen>
  );
}
