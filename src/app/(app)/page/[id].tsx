import { router, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { PageProgressionEditor } from '@/components/gym/progression';
import { TrainDaysEditor } from '@/components/gym/week-plan';
import { WorkoutMuscles } from '@/components/gym/workout-muscles';
import { MoreHorizontal, Play, Share2 } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FieldsDialog } from '@/components/fields';
import { PublishDialog, suggestedKind } from '@/components/publish-dialog';
import { ShoppingDestination } from '@/components/shopping-destination';
import { useFolderActions } from '@/components/folder-actions';
import { ItemIcon, type ItemKind } from '@/components/item-icon';
import { PageDependencyEditor } from '@/components/page-dependency-editor';
import { Related } from '@/components/related';
import { PageDialog } from '@/components/page-dialog';
import { Screen } from '@/components/screen';
import { SendPageDialog } from '@/components/send-page';
import { ScreenHeader } from '@/components/screen-header';
import { ExpensesView } from '@/components/expenses/expenses-view';
import { usePageMode } from '@/components/tasks/page-mode';
import { PageView } from '@/components/tasks/page-view';
import { Text } from '@/components/ui/text';
import { Button, IconButton } from '@/components/ui/button';
import { CarryExercisesDialog } from '@/components/gym/carry-exercises';
import { PageGroupsDialog } from '@/components/gym/page-groups';
import { ActionMenu, PromptDialog, useDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { effectiveMaxDepth } from '@/config/limits';
import { actorCan } from '@/lib/permissions';
import { rootFolder, useFolderActor } from '@/lib/queries/projects';
import { saveTextFile } from '@/lib/download';
import { setLastPageId } from '@/lib/prefs';
import { usePageShares, useReceivedPages } from '@/lib/queries/shares';
import { usePageTasks } from '@/lib/queries/tasks';
import { shoppingList } from '@/lib/shopping';
import { wbsOutline } from '@/lib/task-tree';
import { workoutItems } from '@/lib/workout';
import { subscribeWorkoutRuns, workoutInProgress } from '@/lib/workout-store';
import {
  findFolder,
  isWorkoutPage,
  pageLabel,
  useConfirmedMissing,
  useTree,
  useTreeMutations,
} from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';
import { useCanWrite } from '@/providers/write';

type DialogState =
  | 'menu'
  | 'share'
  | 'settings'
  | 'duplicate'
  | 'send'
  | 'fields'
  | 'shopping'
  | 'publish'
  | 'carry'
  | 'groups';

export default function PageScreen() {
  const { id, send } = useLocalSearchParams<{ id: string; send?: string }>();
  const tree = useTree();
  const m = useTreeMutations();
  const online = useIsOnline();
  const toast = useToast();
  const [dialog, setDialog, closeDialog] = useDialog<DialogState>();
  const [folderActions, folderDialog] = useFolderActions();
  const { t, i18n } = useTranslation();
  // Página recebida (L): não está na árvore; vem do envio
  const received = useReceivedPages();
  const receivedPage = received.data?.find((p) => p.id === id);
  const page = tree.data?.pages.find((p) => p.id === id) ?? receivedPage;
  const missing = useConfirmedMissing(id, !!page);
  const pageTasks = usePageTasks(id);
  const expensesPage = page?.view_type === 'expenses';
  // Treino começado e não terminado: o botão diz "Continuar treino"
  const resumable = useSyncExternalStore(subscribeWorkoutRuns, () => workoutInProgress(id));
  // Relacionados (V3 §2.4): ligar pede editar tarefas aqui
  const [relating, setRelating] = useState(false);
  const pageActor = useFolderActor(page?.folder_id);
  const pageWritable = useCanWrite(page?.folder_id);
  const relatable = pageWritable && actorCan(pageActor, 'task.edit');
  const carriable =
    !!page &&
    !receivedPage &&
    relatable &&
    isWorkoutPage(tree.data, page) &&
    !!pageTasks.data?.some((task) => !task.parent_task_id);
  // Lista de compras do cardápio (PB4): pratos com ingredientes nas subtarefas ou nas notas
  const shopping =
    page && !receivedPage && (page.view_type === 'list' || page.view_type === 'cards')
      ? shoppingList(pageTasks.data ?? [], i18n.language)
      : '';

  // A captura rápida global usa a última página aberta como destino padrão
  useEffect(() => {
    if (page) setLastPageId(page.id);
  }, [page]);

  const sharable =
    !!page &&
    !receivedPage &&
    online &&
    actorCan(pageActor, 'page.share') &&
    !page.is_inbox &&
    !page.is_habits;
  // Painel "Alunos" (L5): só para quem gerencia e com alguém recebendo ao vivo
  const shares = usePageShares(sharable ? page?.id : undefined);
  const hasStudents = !!shares.data?.shares.some((s) => s.mode === 'live' && s.status === 'active');
  // Compartilhar (D262): convidar para a pasta/projeto, enviar a página, publicar e os alunos
  const shareRoot = page ? rootFolder(tree.data, page.folder_id) : null;
  const shareActions =
    !page || receivedPage || !online || page.is_inbox || page.is_habits
      ? []
      : [
          ...(shareRoot && !shareRoot.is_inbox && actorCan(pageActor, 'member.manage')
            ? [
                {
                  label: t('page.invite'),
                  onPress: () =>
                    router.push({ pathname: '/share/[id]', params: { id: shareRoot.id } }),
                },
              ]
            : []),
          ...(sharable && !expensesPage
            ? [{ label: t('send.menu'), onPress: () => setDialog('send') }]
            : []),
          // AC15B: treino da Academia também aparece em grupos de treino
          ...(sharable && shareRoot?.is_gym
            ? [{ label: t('pageGroups.menu'), onPress: () => setDialog('groups') }]
            : []),
          ...(!expensesPage
            ? [{ label: t('publish.menu'), onPress: () => setDialog('publish') }]
            : []),
          ...(hasStudents
            ? [
                {
                  label: t('students.open'),
                  onPress: () => router.push({ pathname: '/alunos/[id]', params: { id: page.id } }),
                },
              ]
            : []),
        ];
  const wide = useWindowDimensions().width >= 768;
  // O quadro (kanban) aproveita a tela toda, como os cards
  const [mode] = usePageMode(page);
  // Paleta: "Enviar esta página"
  useEffect(() => {
    if (send && sharable) setDialog('send');
  }, [send, sharable, setDialog]);

  if (missing && !page && !received.isPending) {
    return (
      <Screen>
        <ScreenHeader help="pastas-projetos-paginas" title={t('page.fallbackTitle')} back />
        <EmptyState title={t('page.missing')} />
      </Screen>
    );
  }

  const onError = (err: Error) => toast({ message: t('page.error', { message: err.message }) });
  // Caminho acima do título: "MERCADO" ou "CASA / COZINHA"
  const place = page ? findFolder(tree.data, page.folder_id) : null;
  const eyebrow = receivedPage
    ? receivedPage.owner_name
      ? t('received.from', { name: receivedPage.owner_name })
      : t('received.title')
    : place
      ? [place.parent?.name, place.folder.name].filter(Boolean).join(' / ')
      : undefined;

  // Cards e kanban aproveitam a tela toda; lista e hábitos ficam numa coluna de leitura
  const size =
    page?.view_type === 'cards' || page?.view_type === 'expenses' || mode === 'board'
      ? 'wide'
      : 'medium';
  return (
    <Screen size={size}>
      <ScreenHeader
        title={page ? pageLabel(page) : ''}
        eyebrow={page?.is_habits || page?.is_inbox ? undefined : eyebrow}
        icon={
          page ? <ItemIcon icon={page.icon} kind={page.view_type as ItemKind} size={20} /> : null
        }
        rename={
          // Páginas de sistema (Caixa de entrada, Hábitos) não mudam de nome
          page && online && !page.is_habits && !page.is_inbox
            ? {
                target: { kind: 'page', id: page.id },
                icon: page.icon,
                iconKind: page.view_type as ItemKind,
                onSave: ({ name, icon }) =>
                  m.updatePage.mutate({ id: page.id, name, icon }, { onError }),
              }
            : undefined
        }
        back
        right={
          // Página de hábitos de sistema: sem configurar nem duplicar; recebida: só executar.
          // D262: Compartilhar (convidar, enviar, publicar, alunos) e o "…" agrupado; o ícone de
          // ajustes saiu (era igual ao da criação avançada, a um dedo dele no celular)
          page && online && !page.is_habits && !receivedPage ? (
            <>
              {shareActions.length > 0 &&
                (wide ? (
                  <Button
                    variant="ghost"
                    icon={Share2}
                    label={t('page.share')}
                    onPress={() => setDialog('share')}
                  />
                ) : (
                  <IconButton
                    icon={Share2}
                    label={t('page.share')}
                    onPress={() => setDialog('share')}
                  />
                ))}
              <IconButton
                icon={MoreHorizontal}
                label={t('page.options')}
                onPress={() => setDialog('menu')}
              />
            </>
          ) : null
        }
      />
      {page && !page.is_habits && !page.is_inbox && !receivedPage && (
        <View className="pb-3">
          <Related
            key={relating ? 'relating' : 'idle'}
            type="page"
            id={page.id}
            editable={relatable}
            hideEmpty
            startSearching={relating}
          />
        </View>
      )}
      {/* W7: o Modo Treino serve para a página de treino e para qualquer uma com séries (CD15) */}
      {page &&
        (pageTasks.data?.length ?? 0) > 0 &&
        (isWorkoutPage(tree.data, page) || pageTasks.data?.some((task) => !!task.repeat_plan)) && (
          <View className="flex-row pb-3">
            <Button
              icon={Play}
              label={t(resumable ? 'workout.continue' : 'workout.start')}
              onPress={() => router.push({ pathname: '/treino/[id]', params: { id: page.id } })}
            />
          </View>
        )}
      {/* AC8.6: os músculos do treino enquanto ele é montado (recolhido numa linha) */}
      {page && isWorkoutPage(tree.data, page) && (pageTasks.data?.length ?? 0) > 0 && (
        <View className="pb-3">
          <WorkoutMuscles
            collapsible
            title={t('workoutMap.planned')}
            entries={workoutItems(pageTasks.data ?? [], {}).map((it) => ({
              exerciseId: it.task.exercise_id,
              sets: it.plan.total,
            }))}
          />
        </View>
      )}
      {page?.view_type === 'expenses' ? <ExpensesView page={page} /> : <PageView page={page} />}
      {folderDialog}

      {page && dialog === 'menu' && (
        <ActionMenu
          title={pageLabel(page)}
          onClose={closeDialog}
          actions={[
            // Arrumar
            {
              group: t('page.groupArrange'),
              label: t('page.settings'),
              onPress: () => setDialog('settings'),
            },
            // Página de gastos (V9) não tem tarefas: duplicar, enviar e campos não se aplicam
            ...(expensesPage
              ? []
              : [
                  {
                    group: t('page.groupArrange'),
                    label: t('page.duplicate'),
                    onPress: () => setDialog('duplicate'),
                  },
                ]),
            {
              group: t('page.groupArrange'),
              label: t('folder.moveTo'),
              onPress: () => folderActions.movePage(page),
            },
            // AC12.3: copiar ou mover exercícios para outro treino
            ...(carriable
              ? [
                  {
                    group: t('page.groupArrange'),
                    label: t('carry.menu'),
                    onPress: () => setDialog('carry'),
                  },
                  {
                    group: t('page.groupArrange'),
                    label: t('organize.title'),
                    onPress: () => {
                      closeDialog();
                      router.push('/organizar-treinos');
                    },
                  },
                ]
              : []),
            // Recursos da página
            ...(actorCan(pageActor, 'page.manage') &&
            !page.is_inbox &&
            !page.is_habits &&
            !expensesPage
              ? [
                  {
                    group: t('page.groupTools'),
                    label: t('fields.menu'),
                    onPress: () => setDialog('fields'),
                  },
                ]
              : []),
            ...(actorCan(pageActor, 'automation.manage') && !page.is_inbox && !page.is_habits
              ? [
                  {
                    group: t('page.groupTools'),
                    label: t('auto.menu'),
                    onPress: () => {
                      const root = rootFolder(tree.data, page.folder_id);
                      if (root)
                        router.push({ pathname: '/automacoes/[id]', params: { id: root.id } });
                    },
                  },
                ]
              : []),
            ...(relatable
              ? [
                  {
                    group: t('page.groupTools'),
                    label: t('related.addTo'),
                    onPress: () => {
                      closeDialog();
                      setRelating(true);
                    },
                  },
                ]
              : []),
            ...(shopping
              ? [
                  {
                    group: t('page.groupTools'),
                    label: t('shopping.menu'),
                    onPress: () => setDialog('shopping'),
                  },
                ]
              : []),
            // Outros
            ...(pageTasks.data?.some((task) => task.parent_task_id)
              ? [
                  {
                    group: t('page.groupOther'),
                    label: t('tree.export'),
                    onPress: () =>
                      saveTextFile(
                        `${page.name}.txt`,
                        wbsOutline(pageTasks.data ?? []),
                        'text/plain',
                      ),
                  },
                ]
              : []),
            ...(actorCan(pageActor, 'page.manage') && !page.is_inbox && !page.is_habits
              ? [
                  {
                    group: t('page.groupOther'),
                    label: t('folder.deletePage'),
                    destructive: true,
                    onPress: () =>
                      folderActions.deletePage(page, () =>
                        router.canGoBack() ? router.back() : router.replace('/'),
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {page && dialog === 'share' && (
        <ActionMenu title={t('page.share')} onClose={closeDialog} actions={shareActions} />
      )}
      {page && dialog === 'send' && <SendPageDialog page={page} onClose={closeDialog} />}
      {page && dialog === 'groups' && <PageGroupsDialog page={page} onClose={closeDialog} />}
      {page && dialog === 'carry' && (
        <CarryExercisesDialog page={page} tasks={pageTasks.data ?? []} onClose={closeDialog} />
      )}
      {page && dialog === 'publish' && (
        <PublishDialog
          source={{ pageId: page.id }}
          name={page.name}
          icon={page.icon}
          kind={suggestedKind(page, isWorkoutPage(tree.data, page))}
          onClose={closeDialog}
        />
      )}
      {page && dialog === 'shopping' && (
        <ShoppingDestination page={page} text={shopping} onClose={closeDialog} />
      )}
      {page && dialog === 'fields' && <FieldsDialog pageId={page.id} onClose={closeDialog} />}
      {page && dialog === 'settings' && (
        <PageDialog
          title={t('page.settings')}
          initial={page}
          inheritedDepth={effectiveMaxDepth(null, rootFolder(tree.data, page.folder_id)?.max_depth)}
          extra={
            isWorkoutPage(tree.data, page)
              ? {
                  label: t('progression.pageRule'),
                  content: (
                    <View className="gap-4">
                      <PageProgressionEditor
                        value={page.progression}
                        onSave={(progression) =>
                          m.updatePage.mutate(
                            { id: page.id, name: page.name, progression },
                            { onError },
                          )
                        }
                      />
                      <Text className="text-sm font-semibold text-ink">{t('weekPlan.days')}</Text>
                      <TrainDaysEditor
                        value={page.train_days}
                        onSave={(train_days) =>
                          m.updatePage.mutate(
                            { id: page.id, name: page.name, train_days },
                            { onError },
                          )
                        }
                      />
                    </View>
                  ),
                }
              : rootFolder(tree.data, page.folder_id)?.kind === 'project' &&
                  page.view_type !== 'habits'
                ? { label: t('pageDeps.label'), content: <PageDependencyEditor page={page} /> }
                : undefined
          }
          onClose={closeDialog}
          onConfirm={(settings) => {
            m.updatePage.mutate({ id: page.id, ...settings }, { onError });
            closeDialog();
          }}
        />
      )}
      {page && dialog === 'duplicate' && (
        <PromptDialog
          title={t('page.duplicate')}
          confirmLabel={t('page.duplicateConfirm')}
          fields={[
            { key: 'name', placeholder: t('page.copyName'), initial: nextName(page.name, t) },
          ]}
          onClose={closeDialog}
          onConfirm={({ name }) => {
            closeDialog();
            m.duplicatePage.mutate(
              { id: page.id, name },
              {
                onError,
                onSuccess: (newId) => {
                  toast({ message: t('page.created', { name }) });
                  if (newId) router.replace({ pathname: '/page/[id]', params: { id: newId } });
                },
              },
            );
          }}
        />
      )}
    </Screen>
  );
}

/** "Treino A" → "Treino B"; o resto ganha " (cópia)". */
function nextName(name: string, t: TFunction) {
  const letter = /^(.*\s)([A-Y])$/.exec(name);
  if (letter) return letter[1] + String.fromCharCode(letter[2].charCodeAt(0) + 1);
  return t('page.copySuffix', { name });
}
