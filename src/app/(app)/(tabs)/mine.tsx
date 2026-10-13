import { SectionList, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { TaskRow } from '@/components/tasks/task-row';
import { addDays } from '@/lib/parser/dates';
import { useToday } from '@/lib/queries/profile';
import { useMyTasks } from '@/lib/queries/projects';
import { pageLabel } from '@/lib/queries/tree';

// Atribuídas a mim (ESCOPO 4.5, D69): abertas e atribuídas a mim, de todos os projetos.
export default function MineScreen() {
  const today = useToday();
  const tasks = useMyTasks();
  const all = tasks.data ?? [];
  const week = addDays(today, 7);

  const groups = [
    { title: 'Atrasadas', data: all.filter((t) => t.due_date && t.due_date < today) },
    { title: 'Hoje', data: all.filter((t) => t.due_date === today) },
    {
      title: 'Próximos 7 dias',
      data: all.filter((t) => t.due_date && t.due_date > today && t.due_date <= week),
    },
    { title: 'Depois', data: all.filter((t) => t.due_date && t.due_date > week) },
    { title: 'Sem data', data: all.filter((t) => !t.due_date) },
  ]
    .filter((g) => g.data.length > 0)
    .map((g) => ({ ...g, title: `${g.title} (${g.data.length})` }));

  return (
    <Screen size="medium">
      <ScreenHeader title="🙋 Atribuídas a mim" back />
      {tasks.error && (
        <Text className="text-danger">Erro ao carregar: {tasks.error.message}</Text>
      )}
      <SectionList
        sections={groups}
        keyExtractor={(task) => task.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-28"
        renderSectionHeader={({ section }) => (
          <Text
            className={
              section.title.startsWith('Atrasadas')
                ? 'mt-4 text-sm font-semibold text-danger'
                : 'mt-4 text-sm font-semibold text-ink-muted'
            }
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            today={today}
            pageLabel={item.page ? pageLabel(item.page) : undefined}
          />
        )}
        ListEmptyComponent={
          tasks.isPending ? null : (
            <View className="mt-10 items-center gap-1">
              <Text className="text-4xl">🙌</Text>
              <Text className="text-center text-ink-muted">
                Nada atribuído a você agora.
              </Text>
              <Text className="text-center text-sm text-ink-muted">
                Em um projeto compartilhado, escreva @nome na tarefa para atribuir a alguém.
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}
