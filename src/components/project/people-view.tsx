import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { openTask, StateMark } from '@/components/project/flow-parts';
import { EmptyState } from '@/components/ui/empty-state';
import { Grid } from '@/components/ui/grid';
import { Avatar } from '@/components/ui/person';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { peopleBoard, type BoardTask, type PersonColumn } from '@/lib/people-board';
import { useProjectFlow } from '@/lib/queries/flow';
import type { FolderNode } from '@/lib/queries/tree';
import type { TaskState } from '@/lib/task-state';
import { useSession } from '@/providers/session';

const DONE_SHOWN = 3;
const READY_SHOWN = 8;

/** Visão Pessoas (V3 §2.6): quem está fazendo o quê, uma coluna por pessoa. */
export function PeopleView({ root }: { root: FolderNode }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const data = useProjectFlow(root);
  if (data.loading) return null;
  const board = peopleBoard({
    tasks: data.tasks,
    deps: data.deps,
    people: data.people,
    members: data.members,
    me: session?.user.id,
  });
  if (!board.length) return <EmptyState title={t('peopleView.empty')} />;
  const titleOf = (id: string) => data.tasks.get(id)?.title ?? '…';

  return (
    <Grid breakpoints={[640, 1000]}>
      {board.map((col) => (
        <PersonCard key={col.key} col={col} titleOf={titleOf} />
      ))}
    </Grid>
  );
}

function PersonCard({ col, titleOf }: { col: PersonColumn; titleOf: (id: string) => string }) {
  const { t } = useTranslation();
  const name = col.name || t('people.unassigned');
  const open = col.doing.length + col.ready.length + col.blocked.length;
  return (
    <View
      role="group"
      aria-label={t('peopleView.card', { name, open, done: col.done.length })}
      className="gap-3 rounded border border-line bg-surface p-3"
    >
      <View className="flex-row items-center gap-2">
        {col.name ? <Avatar name={name} /> : null}
        <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="font-mono text-xs text-ink-muted">
          {t('peopleView.counts', { open, done: col.done.length })}
        </Text>
      </View>
      <Bucket state="doing" title={t('peopleView.doing')} items={col.doing} titleOf={titleOf} />
      <Bucket
        state="ready"
        title={t('peopleView.ready')}
        items={col.ready.slice(0, READY_SHOWN)}
        more={col.ready.length - READY_SHOWN}
        moreKey="peopleView.moreReady"
        titleOf={titleOf}
      />
      <Bucket
        state="blocked"
        title={t('peopleView.blocked')}
        items={col.blocked}
        titleOf={titleOf}
      />
      <Bucket
        state="done"
        title={t('peopleView.done')}
        items={col.done.slice(0, DONE_SHOWN)}
        more={col.done.length - DONE_SHOWN}
        titleOf={titleOf}
      />
      {open === 0 && col.done.length === 0 && (
        <Text className="text-sm text-ink-muted">{t('peopleView.nothing')}</Text>
      )}
    </View>
  );
}

function Bucket({
  state,
  title,
  items,
  more = 0,
  moreKey = 'peopleView.moreDone',
  titleOf,
}: {
  state: TaskState;
  title: string;
  items: BoardTask[];
  more?: number;
  moreKey?: 'peopleView.moreDone' | 'peopleView.moreReady';
  titleOf: (id: string) => string;
}) {
  const { t } = useTranslation();
  if (!items.length) return null;
  return (
    <View accessibilityRole="list" aria-label={title}>
      <Text className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </Text>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} · ${title}`}
          onPress={() => openTask(item.id)}
          className="min-h-11 flex-row items-center gap-2 rounded px-1 hover:bg-wash md:min-h-8"
        >
          <StateMark state={state} />
          <View className="flex-1">
            <Text
              className={cn('text-sm text-ink', state === 'done' && 'text-ink-muted line-through')}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {state === 'blocked' && item.waitingOn.length > 0 && (
              <Text className="text-xs text-ink-muted" numberOfLines={1}>
                {t('flow.blocked', { names: item.waitingOn.map(titleOf).join(', ') })}
              </Text>
            )}
          </View>
        </Pressable>
      ))}
      {more > 0 && (
        <Text className="px-1 text-xs text-ink-muted">{t(moreKey, { count: more })}</Text>
      )}
    </View>
  );
}
