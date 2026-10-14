import { useTranslation } from 'react-i18next';
import { SectionList } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TaskRow } from '@/components/tasks/task-row';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { addDays } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useMyTasks } from '@/lib/queries/projects';
import { pageLabel } from '@/lib/queries/tree';
import { useSelectableList } from '@/lib/selection';

// Atribuídas a mim (ESCOPO 4.5, D69): abertas e atribuídas a mim, de todos os projetos.
export default function MineScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const tasks = useMyTasks();
  const all = tasks.data ?? [];
  const week = addDays(today, 7);

  const groups = [
    {
      title: t('today.overdue'),
      warn: true,
      data: all.filter((task) => task.due_date && task.due_date < today),
    },
    { title: t('today.dueToday'), data: all.filter((task) => task.due_date === today) },
    {
      title: t('mine.upcoming'),
      data: all.filter((task) => task.due_date && task.due_date > today && task.due_date <= week),
    },
    { title: t('mine.later'), data: all.filter((task) => task.due_date && task.due_date > week) },
    { title: t('mine.noDate'), data: all.filter((task) => !task.due_date) },
  ].filter((g) => g.data.length > 0);
  useSelectableList(groups.flatMap((g) => g.data));

  return (
    <Screen size="medium">
      <ScreenHeader title={t('nav.mine')} back />
      {tasks.error && (
        <Text className="text-sm text-danger">
          {t('common.loadError', { message: tasks.error.message })}
        </Text>
      )}
      <SectionList
        sections={groups}
        keyExtractor={(task) => task.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-clear"
        renderSectionHeader={({ section }) => (
          <SectionLabel
            title={section.title}
            count={section.data.length}
            tone={section.warn ? 'warn' : 'muted'}
          />
        )}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            today={today}
            pageLabel={item.page ? pageLabel(item.page) : undefined}
          />
        )}
        ListEmptyComponent={
          tasks.isPending ? null : <EmptyState title={t('mine.empty')} hint={t('mine.emptyHint')} />
        }
      />
    </Screen>
  );
}
