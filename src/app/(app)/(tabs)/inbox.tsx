import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PageView } from '@/components/tasks/page-view';
import { useTree } from '@/lib/queries/tree';

export default function InboxScreen() {
  const tree = useTree();
  return (
    <Screen>
      <ScreenHeader title="📥 Caixa de entrada" />
      <PageView page={tree.data?.inbox ?? undefined} />
    </Screen>
  );
}
