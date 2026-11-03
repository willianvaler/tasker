import { router } from 'expo-router';
import { Circle, CircleCheck } from 'lucide-react-native';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { findDailyNote, renderTemplate, timeIn } from '@/lib/note-templates';
import {
  useDayTasks,
  useNoteMutations,
  useNotes,
  type Note,
  type NewNote,
} from '@/lib/queries/notes';
import { useTimeZone, useToday, useUiPrefs } from '@/lib/queries/profile';
import { pageLabel } from '@/lib/queries/tree';
import type { TaskWithPage } from '@/lib/queries/tasks';
import { useToast } from '@/providers/toast';

/** O texto de uma anotação nova a partir do modelo (variáveis trocadas) */
export function fromTemplate(
  template: Pick<Note, 'body' | 'props'>,
  values: { date: string; time: string; title: string },
): Pick<NewNote, 'body' | 'props'> {
  const props: NewNote['props'] = {};
  for (const [key, value] of Object.entries(template.props ?? {}))
    props[key] = typeof value === 'string' ? renderTemplate(value, values) : value;
  return { body: renderTemplate(template.body, values), props };
}

/**
 * Abre a nota do dia (OB5, D290): a anotação sem pasta com o título AAAA-MM-DD; se não existir,
 * cria, com o modelo da nota do dia (Anotações → Modelos) quando houver. Sem data, é hoje.
 */
export function useOpenDailyNote() {
  const today = useToday();
  const timeZone = useTimeZone();
  const notes = useNotes({ templates: 'include' });
  const m = useNoteMutations();
  const toast = useToast();
  const templateId = useUiPrefs().notes?.dailyTemplate;
  const busy = useRef(false);
  return async (date: string = today) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const list = notes.data ?? (await notes.refetch()).data ?? [];
      const found = findDailyNote(list, date);
      if (found) {
        router.push({ pathname: '/nota/[id]', params: { id: found.id } });
        return;
      }
      const template = list.find((n) => n.id === templateId && n.is_template);
      const content = template
        ? fromTemplate(template, { date, time: timeIn(timeZone), title: date })
        : {};
      const id = await m.create.mutateAsync({ title: date, ...content });
      router.push({ pathname: '/nota/[id]', params: { id } });
    } catch (err) {
      toast({ message: (err as Error).message });
    } finally {
      busy.current = false;
    }
  };
}

/**
 * Diário automático embaixo da nota do dia: as tarefas concluídas e as criadas naquele dia, só
 * para ler (tocar abre a tarefa).
 */
export function DailyJournal({ date }: { date: string }) {
  const { t } = useTranslation();
  const timeZone = useTimeZone();
  const day = useDayTasks(date, timeZone);
  if (!day.data) return null;
  const { done, created } = day.data;
  return (
    <View
      accessibilityRole="summary"
      aria-label={t('dailyNote.journal')}
      testID="daily-journal"
      className="mt-6 gap-3 border-t border-line pt-4"
    >
      <JournalList title={t('dailyNote.done')} tasks={done} done empty={t('dailyNote.noneDone')} />
      <JournalList
        title={t('dailyNote.created')}
        tasks={created}
        empty={t('dailyNote.noneCreated')}
      />
    </View>
  );
}

function JournalList({
  title,
  tasks,
  done,
  empty,
}: {
  title: string;
  tasks: TaskWithPage[];
  done?: boolean;
  empty: string;
}) {
  return (
    <View accessibilityRole="list" aria-label={title}>
      <SectionLabel title={title} count={tasks.length || undefined} />
      {tasks.length === 0 && <Text className="py-1 text-sm text-ink-muted">{empty}</Text>}
      {tasks.map((task) => (
        <Pressable
          key={task.id}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
          className="min-h-9 flex-row items-center gap-2 rounded px-1 hover:bg-wash"
        >
          <Icon icon={done || task.status === 'done' ? CircleCheck : Circle} tone="ink-muted" />
          <Text
            numberOfLines={1}
            className={
              done ? 'flex-1 text-sm text-ink-muted line-through' : 'flex-1 text-sm text-ink'
            }
          >
            {task.title}
          </Text>
          {task.page && (
            <Text numberOfLines={1} className="max-w-[40%] font-mono text-xs text-ink-muted">
              {pageLabel(task.page)}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
