import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { tr } from '@/lib/i18n-ref';

import { WorkoutLive } from '../../modules/workout-live';

// Treino pela tela de bloqueio (X1, ESCOPO_V5 §1.1): enquanto o Modo Treino está aberto, uma
// notificação fixa e visível na tela de bloqueio mostra o exercício e a série (ou até que horas
// vai o descanso), com botões que funcionam sem destravar: Feita, Pular descanso e +30 s. O toque
// num botão chega ao app em segundo plano (listener) e roda a mesma ação dos botões da tela.
//
// No Android com o módulo nativo (D284, modules/workout-live), a notificação é montada lá: o
// descanso é um cronômetro que o Android conta sozinho, a barra mostra as séries do treino, no
// Android 16 ela vira atualização ao vivo (chip na barra de status) e um serviço em primeiro plano
// mantém o app vivo com o celular travado. Sem o módulo (iPhone, Expo Go), fica a do D173.

export type WorkoutAction = 'done' | 'skip_rest' | 'plus30';

export type WorkoutLockContent = {
  title: string;
  /** O texto da notificação comum (D173), com a hora em que o descanso acaba */
  body: string;
  resting: boolean;
  /** Daqui para baixo, só o módulo nativo usa */
  liveBody: string;
  /** Fim do descanso correndo (ms); pausado ou sem descanso, null */
  restEndsAt: number | null;
  /** O texto quando o descanso acabar sozinho */
  afterBody: string;
  chip: string;
  segments: number[];
  progress: number;
};

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

/** Mostra ou atualiza a notificação do treino */
export async function showWorkoutNotification(content: WorkoutLockContent) {
  const live = WorkoutLive;
  if (live)
    return enqueue(() =>
      live.show({
        title: content.title,
        body: content.liveBody,
        resting: content.resting,
        restEndsAt: content.restEndsAt,
        afterTitle: content.title,
        afterBody: content.afterBody,
        afterChip: null,
        chip: content.chip,
        segments: content.segments,
        progress: content.progress,
        channelName: tr('lock.channel'),
        doneLabel: tr('lock.done'),
        skipRestLabel: tr('lock.skipRest'),
        plus30Label: tr('lock.plus30'),
      }),
    );
  return enqueue(async () => {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await setup();
    const id = `${ID_PREFIX}${Date.now()}-${++seq}`;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: content.title,
        body: content.body,
        categoryIdentifier: content.restEndsAt != null ? CATEGORY_REST : CATEGORY_SET,
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
  return enqueue(async () => {
    await WorkoutLive?.clear();
    await dismissWorkout();
  });
}

/** Toques nos botões da notificação do treino; devolve a função de parar de ouvir */
export function onWorkoutAction(handler: (action: WorkoutAction) => void) {
  if (WorkoutLive) {
    const live = WorkoutLive.addListener('onAction', ({ action }) => {
      if (ACTIONS.includes(action)) handler(action);
    });
    return () => live.remove();
  }
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (!response.notification.request.identifier.startsWith(ID_PREFIX)) return;
    const action = response.actionIdentifier as WorkoutAction;
    if (ACTIONS.includes(action)) handler(action);
  });
  return () => sub.remove();
}
