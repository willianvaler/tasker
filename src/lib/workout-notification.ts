import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { tr } from '@/lib/i18n-ref';

// Treino pela tela de bloqueio (X1, ESCOPO_V5 §1.1): enquanto o Modo Treino está aberto, uma
// notificação fixa e visível na tela de bloqueio mostra o exercício e a série (ou até que horas
// vai o descanso), com botões que funcionam sem destravar: Feita, Pular descanso e +30 s. O toque
// num botão chega ao app em segundo plano (listener) e roda a mesma ação dos botões da tela.
// Com o app encerrado de vez, os botões não fazem nada (fica para uma tarefa em segundo plano).

export type WorkoutAction = 'done' | 'skip_rest' | 'plus30';

// Cada atualização ganha um id novo (e a anterior sai): o Android reaproveitava os botões da versão
// anterior da notificação e o toque em "Pular descanso"/"+30 s" não chegava. Quem sai é toda
// notificação do treino que está na tela, não só a última que este processo mostrou: o app fechado
// pelo sistema (ou recarregado) esquecia o id e as fixas iam se acumulando na tela de bloqueio
const ID_PREFIX = 'questlist-workout-';
let seq = 0;
// Mostrar e apagar em fila, na ordem: um "apagar" atrasado não pode levar a notificação nova
let chain: Promise<unknown> = Promise.resolve();
const enqueue = (job: () => Promise<void>) => {
  chain = chain.then(job, job).catch(() => {});
  return chain;
};
const CHANNEL = 'workout';
const CATEGORY_SET = 'workout_set';
const CATEGORY_REST = 'workout_rest';
const ACTIONS: readonly WorkoutAction[] = ['done', 'skip_rest', 'plus30'];

let ready: Promise<void> | null = null;

/** Canal (silencioso, público na tela de bloqueio) e os botões, nos textos do idioma atual */
function setup() {
  ready ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: tr('lock.channel'),
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: null,
        vibrationPattern: null,
        enableVibrate: false,
        showBadge: false,
      });
    }
    const button = (id: WorkoutAction, key: string) => ({
      identifier: id,
      buttonTitle: tr(key),
      options: { opensAppToForeground: false },
    });
    await Notifications.setNotificationCategoryAsync(CATEGORY_SET, [button('done', 'lock.done')]);
    await Notifications.setNotificationCategoryAsync(CATEGORY_REST, [
      button('skip_rest', 'lock.skipRest'),
      button('plus30', 'lock.plus30'),
      button('done', 'lock.done'),
    ]);
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** Mostra ou atualiza (mesmo id) a notificação do treino */
export async function showWorkoutNotification(content: {
  title: string;
  body: string;
  resting: boolean;
}) {
  return enqueue(async () => {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await setup();
    const id = `${ID_PREFIX}${Date.now()}-${++seq}`;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: content.title,
        body: content.body,
        categoryIdentifier: content.resting ? CATEGORY_REST : CATEGORY_SET,
        sticky: true,
        autoDismiss: false,
        sound: false,
        data: { workout: true },
      },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
    await dismissWorkout(id);
  });
}

/** Apaga as notificações do treino na tela, menos a `keep` */
async function dismissWorkout(keep?: string) {
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    shown
      .map((n) => n.request.identifier)
      .filter((id) => id.startsWith(ID_PREFIX) && id !== keep)
      .map((id) => Notifications.dismissNotificationAsync(id).catch(() => {})),
  );
}

/** Tira a notificação do treino (sair do Modo Treino ou abrir o app sem treino aberto) */
export function clearWorkoutNotification() {
  return enqueue(() => dismissWorkout());
}

/** Toques nos botões da notificação do treino; devolve a função de parar de ouvir */
export function onWorkoutAction(handler: (action: WorkoutAction) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (!response.notification.request.identifier.startsWith(ID_PREFIX)) return;
    const action = response.actionIdentifier as WorkoutAction;
    if (ACTIONS.includes(action)) handler(action);
  });
  return () => sub.remove();
}
