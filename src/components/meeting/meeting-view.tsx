import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, ChevronRight, FileText, Play, Plus, Square } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { READABLE, ScreenScroll } from '@/components/screen';
import { openTask } from '@/lib/open-task';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import { resolveMention, toAssignees } from '@/lib/members';
import {
  buildMinutes,
  findActions,
  nextItem,
  nextMeetingDate,
  plannedMinutes,
  readMeeting,
  writeMeeting,
  type MeetingConfig,
  type MeetingRepeat,
} from '@/lib/meeting';
import { actorCan } from '@/lib/permissions';
import { formatShortDate } from '@/lib/parser/dates';
import { parseQuickInput, parseTime } from '@/lib/parser/quick';
import { useProjectAllTasks } from '@/lib/queries/flow';
import { keys } from '@/lib/queries/keys';
import { useNoteMutations } from '@/lib/queries/notes';
import { useToday } from '@/lib/queries/profile';
import {
  assigneesOf,
  rootFolder,
  useAssignees,
  useFolderActor,
  useMembers,
} from '@/lib/queries/projects';
import { useCreateTasks, usePageTasks, useUpdateTask, type Task } from '@/lib/queries/tasks';
import { useTimerActions } from '@/lib/queries/timers';
import { addPageToTree, useTree, useTreeMutations, type Page, type Tree } from '@/lib/queries/tree';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/sync/db';
import { isLocal } from '@/lib/sync/local';
import { uuidv7 } from '@/lib/uuid';
import { linkMarkup } from '@/lib/wikilinks';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

const REPEATS: MeetingRepeat[] = ['none', 'weekly', 'biweekly'];

type TaskState = { id: string; title: string; status: string; started_at: string | null };

/** As ações podem ter ido para outra lista (ou a Caixa de entrada): busca pelos ids. */
function useTasksByIds(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['tasks', 'by-ids', sorted.join(',')],
    enabled: sorted.length > 0,
    networkMode: isLocal() ? 'always' : 'online',
    queryFn: async (): Promise<TaskState[]> => {
      if (isLocal())
        return db.getAll<TaskState>(
          'select id, title, status, started_at from tasks where id in (select value from json_each(?))',
          [JSON.stringify(sorted)],
        );
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, started_at')
        .in('id', sorted);
      if (error) throw error;
      return data ?? [];
    },
  });
}
/** "[[Título|t:<id>]]" no começo das anotações do item: a tarefa a que ele aponta */
const refOf = (notes: string | null) => /\|t:([0-9a-f-]{36})\]\]/i.exec(notes ?? '')?.[1] ?? null;

/**
 * Reunião (GP1, D313): uma lista do tipo 'meeting'. A pauta são as tarefas da lista; data, lugar,
 * participantes, condução e ata ficam em pages.config.meeting. Encerrar gera a ata (anotação) e
 * transforma cada `[ ] ação` das anotações em tarefa de verdade.
 */
export function MeetingView({ page }: { page: Page }) {
  const { t } = useTranslation();
  const toast = useToast();
  const today = useToday();
  const tree = useTree();
  const root = rootFolder(tree.data, page.folder_id);
  const members = useMembers(root?.id);
  const assignees = useAssignees();
  const projectTasks = useProjectAllTasks(root);
  const tasks = usePageTasks(page.id);
  const actor = useFolderActor(page.folder_id);
  const writable = useCanWrite(page.folder_id);
  const manage = writable && actorCan(actor, 'meeting.manage');
  const { updatePage, createPage } = useTreeMutations();
  const create = useCreateTasks();
  const update = useUpdateTask();
  const notes = useNoteMutations();
  const timers = useTimerActions();
  const meeting = readMeeting(page.config);

  const items = (tasks.data ?? [])
    .filter((x) => !x.parent_task_id)
    // Mesma posição (dois itens criados em seguida, com o sync): a id (uuidv7) desempata pela ordem
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const memberName = (id: string) =>
    members.data?.find((m) => m.userId === id)?.displayName ?? t('common.someone');
  const presenterOf = (task: Task) => {
    const a = assigneesOf(assignees.data, task.id)[0];
    return a ? (a.user_id ? memberName(a.user_id) : a.pending_name) : null;
  };
  const prevPage = meeting.prev ? tree.data?.pages.find((p) => p.id === meeting.prev) : undefined;
  const actionTasks = useTasksByIds([
    ...meeting.actions,
    ...(prevPage ? readMeeting(prevPage.config).actions : []),
  ]);
  const stateOf = (id: string): TaskState | undefined =>
    projectTasks.data?.find((x) => x.id === id) ?? actionTasks.data?.find((x) => x.id === id);

  // Gravações em fila, na ordem, e a árvore em cache já com a mudança: dois toques seguidos (um
  // participante e "Salvar") não podem chegar fora de ordem e um apagar o outro
  const queryClient = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const save = (next: MeetingConfig) => {
    const config = writeMeeting(page.config, next);
    queryClient.setQueryData<Tree>(keys.tree, (data) =>
      data
        ? { ...data, pages: data.pages.map((p) => (p.id === page.id ? { ...p, config } : p)) }
        : data,
    );
    const run = queue.current.then(() =>
      // O ícone vai junto: o updatePage grava o que não vier como vazio
      updatePage.mutateAsync({ id: page.id, name: page.name, icon: page.icon, config }),
    );
    queue.current = run.catch(() => undefined);
    return run;
  };

  function startTimer(item: Task | undefined) {
    if (!item?.estimate_minutes) return;
    void timers
      .start({
        kind: 'countdown',
        seconds: item.estimate_minutes * 60,
        taskId: item.id,
        config: { label: item.title },
      })
      .catch(() => undefined);
  }

  function begin() {
    const first = nextItem(
      items.map((i) => i.id),
      [],
      null,
    );
    void save({
      ...meeting,
      status: 'running',
      started_at: new Date().toISOString(),
      current: first,
      discussed: [],
      present: meeting.participants,
    });
    startTimer(items.find((i) => i.id === first));
  }

  function advance() {
    const discussed = meeting.current ? [...meeting.discussed, meeting.current] : meeting.discussed;
    const current = nextItem(
      items.map((i) => i.id),
      discussed,
      null,
    );
    void save({ ...meeting, discussed, current });
    startTimer(items.find((i) => i.id === current));
  }

  // O que foi digitado nesta sessão vale mais que o cache (a gravação pode estar na fila do sync)
  const drafts = useRef<Record<string, string>>({});
  const notesOf = (item: Task) => drafts.current[item.id] ?? item.notes ?? '';
  const generalNotes = () => drafts.current.general ?? meeting.notes;

  // Encerrar: ações viram tarefas, a ata vira anotação e a reunião fica só leitura
  const [ending, setEnding] = useState(false);
  async function end() {
    setEnding(false);
    const discussed = meeting.current ? [...meeting.discussed, meeting.current] : meeting.discussed;
    const names = (members.data ?? []).map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      aliases: m.aliases,
    }));
    const project = root?.kind === 'project';
    const texts = [...items.map(notesOf), generalNotes()].flatMap(findActions);
    // As ações vão para a primeira lista comum da pasta (ou para a Caixa de entrada)
    const target =
      tree.data?.pages.find(
        (p) =>
          p.folder_id === page.folder_id &&
          p.id !== page.id &&
          (p.view_type === 'list' || p.view_type === 'cards' || p.view_type === 'kanban'),
      )?.id ?? tree.data?.inbox?.id;
    const actions = texts.map((text) => {
      const parsed = parseQuickInput(text, { today });
      const resolved = parsed.mentions.map((name) => resolveMention(name, names));
      return {
        id: uuidv7(),
        parsed,
        assignees: project ? toAssignees(resolved) : [],
        who: resolved.map((r) => (r.kind === 'member' ? memberName(r.userId) : r.name)).join(', '),
      };
    });
    try {
      if (actions.length && target) {
        await create.mutateAsync({
          pageId: target,
          items: actions.map((a) => ({ ...a.parsed, id: a.id, assignees: a.assignees })),
        });
        const back = linkMarkup(page.name, 'page', page.id);
        for (const a of actions)
          update.mutate({ id: a.id, patch: { notes: t('meeting.fromMeeting', { link: back }) } });
      }
      const body = buildMinutes({
        title: page.name,
        date: meeting.date,
        time: meeting.time,
        place: meeting.place,
        present: [...meeting.present.map(memberName), ...meeting.guests],
        absent: meeting.participants.filter((p) => !meeting.present.includes(p)).map(memberName),
        items: items.map((i) => ({
          title: i.title,
          presenter: presenterOf(i),
          notes: notesOf(i),
          discussed: discussed.includes(i.id),
        })),
        notes: generalNotes(),
        actions: actions.map((a) => ({ title: a.parsed.title, who: a.who || null })),
      });
      const noteId = await notes.create.mutateAsync({
        folderId: page.folder_id,
        title: t('meeting.minutesTitle', { name: page.name, date: meeting.date ?? today }),
        body: `${body}\n${linkMarkup(page.name, 'page', page.id)}\n`,
      });
      await save({
        ...meeting,
        status: 'done',
        current: null,
        discussed,
        ended_at: new Date().toISOString(),
        minutes_note_id: noteId,
        actions: actions.map((a) => a.id),
      });
      toast({ message: t('meeting.ended', { count: actions.length }) });
    } catch (e) {
      toast({ message: t('meeting.error', { message: (e as Error).message }) });
    }
  }

  // Próxima da série: mesma pauta (sem as anotações), mesmas pessoas, data pela repetição
  async function nextMeeting() {
    try {
      const date = nextMeetingDate(meeting.date, meeting.repeat, today);
      const nextConfig = writeMeeting(null, {
        ...readMeeting(null),
        date,
        time: meeting.time,
        duration: meeting.duration,
        place: meeting.place,
        participants: meeting.participants,
        guests: meeting.guests,
        repeat: meeting.repeat,
        prev: page.id,
      });
      const id = await createPage.mutateAsync({
        folderId: page.folder_id,
        name: page.name,
        icon: page.icon,
        view_type: 'meeting',
        config: nextConfig,
      });
      if (items.length)
        await create.mutateAsync({
          pageId: id,
          items: items.map((i) => ({
            ...parseQuickInput('x', { today }),
            title: i.title,
            id: uuidv7(),
            assignees: assigneesOf(assignees.data, i.id).map((a) =>
              a.user_id ? { user_id: a.user_id } : { pending_name: a.pending_name ?? '' },
            ),
          })),
        });
      await save({ ...meeting, next: id });
      // A lista nova já entra na árvore em cache (sem conexão a árvore não recarrega)
      addPageToTree(queryClient, {
        id,
        folder_id: page.folder_id,
        name: page.name,
        icon: page.icon,
        view_type: 'meeting',
        config: nextConfig,
      });
      router.push(`/page/${id}`);
    } catch (e) {
      toast({ message: t('meeting.error', { message: (e as Error).message }) });
    }
  }

  const prevActions = prevPage ? readMeeting(prevPage.config).actions : [];
  const current = items.find((i) => i.id === meeting.current);
  const planned = plannedMinutes(items);

  return (
    <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerClassName="pb-clear">
      <View className={cn(READABLE, 'gap-8')}>
        <MeetingHeader
          meeting={meeting}
          manage={manage && meeting.status !== 'done'}
          members={(members.data ?? []).map((m) => ({ id: m.userId, name: m.displayName }))}
          onSave={save}
        />

        {prevActions.length > 0 && (
          <View className="gap-2">
            <SectionLabel title={t('meeting.prevActions')} count={prevActions.length} />
            {prevActions.map((id) => {
              const task = stateOf(id);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="link"
                  onPress={() => openTask(id, page.folder_id)}
                  className="flex-row items-center gap-2 py-1"
                >
                  <Text
                    className={task?.status === 'done' ? 'text-ink-muted line-through' : 'text-ink'}
                  >
                    {task?.title ?? t('meeting.missingTask')}
                  </Text>
                  <Text className="text-sm text-ink-muted">
                    {task
                      ? t(
                          `meeting.taskState.${task.status === 'done' ? 'done' : task.started_at ? 'started' : 'open'}`,
                        )
                      : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View className="gap-2">
          <SectionLabel
            title={t('meeting.agenda')}
            count={items.length || undefined}
            right={
              planned ? (
                <Text className="text-sm text-ink-muted">
                  {t('meeting.planned', { minutes: planned, total: meeting.duration })}
                </Text>
              ) : undefined
            }
          />
          {items.length === 0 && <Text className="text-ink-muted">{t('meeting.emptyAgenda')}</Text>}
          {items.map((item, i) => {
            const ref = refOf(item.notes);
            const refTask = ref ? stateOf(ref) : undefined;
            const isCurrent = item.id === meeting.current;
            const wasDiscussed = meeting.discussed.includes(item.id);
            return (
              <View
                key={item.id}
                className={cn(
                  'gap-1 rounded border border-line p-3',
                  isCurrent && 'border-accent bg-wash',
                )}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('meeting.openItem', { title: item.title })}
                  onPress={() => openTask(item.id, page.folder_id)}
                  className="flex-row items-center gap-2"
                >
                  {wasDiscussed ? (
                    <Check size={16} color="currentColor" />
                  ) : (
                    <Text className="w-5 font-mono text-sm text-ink-muted">{i + 1}.</Text>
                  )}
                  <Text
                    className={cn(
                      'flex-1 text-ink',
                      isCurrent && 'font-semibold',
                      wasDiscussed && 'text-ink-muted',
                    )}
                  >
                    {item.title}
                  </Text>
                  <Text className="text-sm text-ink-muted">
                    {[
                      presenterOf(item),
                      item.estimate_minutes ? `${item.estimate_minutes} min` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
                {refTask && (
                  <Text className="text-sm text-ink-muted">
                    {t('meeting.refState', {
                      title: refTask.title,
                      state: t(
                        `meeting.taskState.${refTask.status === 'done' ? 'done' : refTask.started_at ? 'started' : 'open'}`,
                      ),
                    })}
                  </Text>
                )}
                {isCurrent && meeting.status === 'running' && (
                  <ItemNotes
                    task={item}
                    editable={manage}
                    onDraft={(text) => (drafts.current[item.id] = text)}
                  />
                )}
              </View>
            );
          })}
          {manage && meeting.status === 'planned' && (
            <AddItem
              pageId={page.id}
              members={members.data ?? []}
              projectTasks={(projectTasks.data ?? []).filter(
                (x) => x.page_id !== page.id && x.status !== 'done',
              )}
            />
          )}
        </View>

        {meeting.status === 'running' && (
          <View className="gap-3">
            <SectionLabel title={t('meeting.generalNotes')} />
            <GeneralNotes
              meeting={meeting}
              editable={manage}
              onSave={save}
              onDraft={(text) => (drafts.current.general = text)}
            />
            {meeting.participants.length > 0 && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-ink">{t('meeting.present')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {meeting.participants.map((id) => (
                    <Chip
                      key={id}
                      role="checkbox"
                      label={memberName(id)}
                      selected={meeting.present.includes(id)}
                      disabled={!manage}
                      onPress={() =>
                        void save({
                          ...meeting,
                          present: meeting.present.includes(id)
                            ? meeting.present.filter((x) => x !== id)
                            : [...meeting.present, id],
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            )}
            <Text className="text-sm text-ink-muted">{t('meeting.actionsHint')}</Text>
          </View>
        )}

        {manage && (
          <View className="flex-row flex-wrap gap-2">
            {meeting.status === 'planned' && (
              <Button
                icon={Play}
                label={t('meeting.begin')}
                disabled={!items.length}
                onPress={begin}
              />
            )}
            {meeting.status === 'running' && (
              <>
                <Button
                  icon={ChevronRight}
                  label={
                    current &&
                    nextItem(
                      items.map((i) => i.id),
                      meeting.discussed,
                      meeting.current,
                    )
                      ? t('meeting.next')
                      : t('meeting.lastDone')
                  }
                  disabled={!current}
                  onPress={advance}
                />
                <Button
                  variant="ghost"
                  icon={Square}
                  label={t('meeting.end')}
                  onPress={() => setEnding(true)}
                />
              </>
            )}
            {meeting.status === 'done' && !meeting.next && (
              <Button
                variant="ghost"
                icon={Plus}
                label={t('meeting.nextMeeting')}
                onPress={() => void nextMeeting()}
              />
            )}
          </View>
        )}

        {meeting.status === 'done' && (
          <View className="gap-2">
            <SectionLabel title={t('meeting.after')} />
            {meeting.minutes_note_id && (
              <Button
                variant="ghost"
                icon={FileText}
                className="self-start"
                label={t('meeting.openMinutes')}
                onPress={() => router.push(`/nota/${meeting.minutes_note_id}`)}
              />
            )}
            {meeting.actions.length === 0 ? (
              <Text className="text-ink-muted">{t('meeting.noActions')}</Text>
            ) : (
              meeting.actions.map((id) => {
                const task = stateOf(id);
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="link"
                    onPress={() => openTask(id, page.folder_id)}
                    className="py-1"
                  >
                    <Text
                      className={
                        task?.status === 'done' ? 'text-ink-muted line-through' : 'text-ink'
                      }
                    >
                      {task?.title ?? t('meeting.actionElsewhere')}
                    </Text>
                  </Pressable>
                );
              })
            )}
            {meeting.next && (
              <Button
                variant="ghost"
                className="self-start"
                label={t('meeting.openNext')}
                onPress={() => router.push(`/page/${meeting.next}`)}
              />
            )}
          </View>
        )}

        {ending && (
          <ConfirmDialog
            title={t('meeting.endTitle')}
            message={t('meeting.endMessage')}
            confirmLabel={t('meeting.end')}
            onClose={() => setEnding(false)}
            onConfirm={() => void end()}
          />
        )}
      </View>
    </ScreenScroll>
  );
}

function MeetingHeader({
  meeting,
  manage,
  members,
  onSave,
}: {
  meeting: MeetingConfig;
  manage: boolean;
  members: { id: string; name: string }[];
  onSave: (next: MeetingConfig) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const today = useToday();
  const [date, setDate] = useState(meeting.date ?? '');
  const [time, setTime] = useState(meeting.time ?? '');
  const [duration, setDuration] = useState(String(meeting.duration));
  const [place, setPlace] = useState(meeting.place ?? '');
  const [guests, setGuests] = useState(meeting.guests.join(', '));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  const when = [meeting.date ? formatShortDate(meeting.date) : null, meeting.time]
    .filter(Boolean)
    .join(' · ');
  const summary = [when || t('meeting.noDate'), `${meeting.duration} min`, meeting.place]
    .filter(Boolean)
    .join(' · ');
  const people = [...meeting.participants.map(nameOf), ...meeting.guests];

  if (!manage)
    return (
      <View className="gap-1">
        <Text className="text-ink">{summary}</Text>
        {people.length > 0 && <Text className="text-sm text-ink-muted">{people.join(', ')}</Text>}
        <Text className="text-sm text-ink-muted">{t(`meeting.status.${meeting.status}`)}</Text>
      </View>
    );

  const parsedDate = date.trim()
    ? (parseQuickInput(`x ${date}`, { today }).dueDate ??
      (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null))
    : null;
  const parsedTime = time.trim() ? parseTime(time.trim().replace(/\s+/g, '')) : null;
  const minutes = /^\d+$/.test(duration) ? Number(duration) : NaN;
  const problem =
    (date.trim() && !parsedDate) || (time.trim() && !parsedTime)
      ? t('meeting.whenInvalid')
      : !(minutes >= 5 && minutes <= 600)
        ? t('meeting.durationInvalid')
        : null;
  const store = (patch: Partial<MeetingConfig>) => void onSave({ ...meeting, ...patch });

  return (
    <View className="gap-3">
      <Text className="text-sm text-ink-muted">{t(`meeting.status.${meeting.status}`)}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Input
          className="min-w-32 flex-1"
          value={date}
          onChangeText={setDate}
          placeholder={t('meeting.datePlaceholder')}
          accessibilityLabel={t('meeting.date')}
        />
        <Input
          className="w-24"
          value={time}
          onChangeText={setTime}
          placeholder={t('meeting.timePlaceholder')}
          accessibilityLabel={t('meeting.time')}
        />
        <Input
          className="w-24"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          accessibilityLabel={t('meeting.duration')}
        />
      </View>
      <Input
        value={place}
        onChangeText={setPlace}
        maxLength={300}
        placeholder={t('meeting.placePlaceholder')}
        accessibilityLabel={t('meeting.place')}
      />
      {members.length > 0 && (
        <View className="gap-1">
          <Text className="text-sm font-semibold text-ink">{t('meeting.participants')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {members.map((m) => (
              <Chip
                key={m.id}
                role="checkbox"
                label={m.name}
                selected={meeting.participants.includes(m.id)}
                onPress={() =>
                  store({
                    participants: meeting.participants.includes(m.id)
                      ? meeting.participants.filter((x) => x !== m.id)
                      : [...meeting.participants, m.id],
                  })
                }
              />
            ))}
          </View>
        </View>
      )}
      <Input
        value={guests}
        onChangeText={setGuests}
        maxLength={300}
        placeholder={t('meeting.guestsPlaceholder')}
        accessibilityLabel={t('meeting.guests')}
      />
      <View className="gap-1">
        <Text className="text-sm font-semibold text-ink">{t('meeting.repeat')}</Text>
        <View
          role="radiogroup"
          aria-label={t('meeting.repeat')}
          className="flex-row flex-wrap gap-2"
        >
          {REPEATS.map((r) => (
            <Chip
              key={r}
              role="radio"
              label={t(`meeting.repeats.${r}`)}
              selected={meeting.repeat === r}
              onPress={() => store({ repeat: r })}
            />
          ))}
        </View>
      </View>
      {problem && <Text className="text-sm text-danger">{problem}</Text>}
      <Button
        className="self-start"
        variant="ghost"
        label={t('meeting.saveDetails')}
        disabled={!!problem}
        onPress={() =>
          store({
            date: parsedDate,
            time: parsedTime,
            duration: minutes,
            place: place.trim() || null,
            guests: guests
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean)
              .slice(0, 30),
          })
        }
      />
      <Text className="text-sm text-ink-muted">{summary}</Text>
    </View>
  );
}

function AddItem({
  pageId,
  members,
  projectTasks,
}: {
  pageId: string;
  members: { userId: string; displayName: string }[];
  projectTasks: { id: string; title: string }[];
}) {
  const { t } = useTranslation();
  const today = useToday();
  const create = useCreateTasks();
  const update = useUpdateTask();
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [presenter, setPresenter] = useState<string | null>(null);
  const [ref, setRef] = useState<{ id: string; title: string } | null>(null);
  const query = title.trim().toLowerCase();
  const suggestions =
    query.length >= 2 && !ref
      ? projectTasks.filter((x) => x.title.toLowerCase().includes(query)).slice(0, 5)
      : [];

  async function add() {
    const text = (ref?.title ?? title).trim();
    if (!text) return;
    const linked = ref;
    const estimate = /^\d+$/.test(minutes) ? Number(minutes) : null;
    // Limpa já: a resposta pode demorar (fila do sync) e a pessoa já estar digitando o próximo
    setTitle('');
    setRef(null);
    const id = uuidv7();
    try {
      await create.mutateAsync({
        pageId,
        items: [
          {
            ...parseQuickInput('x', { today }),
            title: text,
            id,
            assignees: presenter ? [{ user_id: presenter }] : [],
          },
        ],
      });
      update.mutate({
        id,
        patch: {
          estimate_minutes: estimate,
          ...(linked ? { notes: `${linkMarkup(linked.title, 'task', linked.id)}\n` } : {}),
        },
      });
    } catch {
      setTitle(text);
    }
  }

  return (
    <View className="gap-2 pt-2">
      <View className="flex-row gap-2">
        <Input
          className="flex-1"
          value={ref ? ref.title : title}
          onChangeText={(v) => {
            setRef(null);
            setTitle(v);
          }}
          maxLength={200}
          placeholder={t('meeting.itemPlaceholder')}
          accessibilityLabel={t('meeting.itemTitle')}
          submitBehavior="submit"
          onSubmitEditing={() => void add()}
        />
        <Input
          className="w-20"
          value={minutes}
          onChangeText={setMinutes}
          keyboardType="number-pad"
          accessibilityLabel={t('meeting.itemMinutes')}
        />
      </View>
      {suggestions.length > 0 && (
        <View className="gap-1">
          <Text className="text-xs text-ink-muted">{t('meeting.linkTask')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s.id} label={s.title} onPress={() => setRef(s)} />
            ))}
          </View>
        </View>
      )}
      {members.length > 1 && (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm text-ink-muted">{t('meeting.presenter')}</Text>
          {members.map((m) => (
            <Chip
              key={m.userId}
              role="radio"
              label={m.displayName}
              selected={presenter === m.userId}
              onPress={() => setPresenter(presenter === m.userId ? null : m.userId)}
            />
          ))}
        </View>
      )}
      <Button
        variant="ghost"
        icon={Plus}
        className="self-start"
        label={t('meeting.addItem')}
        disabled={!(ref?.title ?? title).trim()}
        onPress={() => void add()}
      />
    </View>
  );
}

function ItemNotes({
  task,
  editable,
  onDraft,
}: {
  task: Task;
  editable: boolean;
  onDraft: (text: string) => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateTask();
  const [text, setText] = useState(task.notes ?? '');
  return (
    <Input
      multiline
      className="min-h-24"
      value={text}
      editable={editable}
      onChangeText={(v) => {
        setText(v);
        onDraft(v);
      }}
      onBlur={() =>
        text !== (task.notes ?? '') && update.mutate({ id: task.id, patch: { notes: text } })
      }
      placeholder={t('meeting.itemNotesPlaceholder')}
      accessibilityLabel={t('meeting.itemNotes', { title: task.title })}
    />
  );
}

function GeneralNotes({
  meeting,
  editable,
  onSave,
  onDraft,
}: {
  meeting: MeetingConfig;
  editable: boolean;
  onSave: (next: MeetingConfig) => Promise<unknown>;
  onDraft: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(meeting.notes);
  return (
    <Input
      multiline
      className="min-h-24"
      value={text}
      editable={editable}
      onChangeText={(v) => {
        setText(v);
        onDraft(v);
      }}
      onBlur={() =>
        text !== meeting.notes && void onSave({ ...meeting, notes: text.slice(0, 20000) })
      }
      placeholder={t('meeting.itemNotesPlaceholder')}
      accessibilityLabel={t('meeting.generalNotes')}
    />
  );
}
