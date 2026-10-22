import { useTranslation } from 'react-i18next';

import { ItemIcon } from '@/components/item-icon';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PageView } from '@/components/tasks/page-view';
import { useTree } from '@/lib/queries/tree';

export default function InboxScreen() {
  const { t } = useTranslation();
  const tree = useTree();
  return (
    <Screen size="medium">
      <ScreenHeader search title={t('nav.inbox')} icon={<ItemIcon kind="inbox" size={20} />} />
      <PageView page={tree.data?.inbox ?? undefined} />
    </Screen>
  );
}
