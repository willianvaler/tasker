import { NativeModule, requireOptionalNativeModule } from 'expo';

// Módulo nativo do treino na tela de bloqueio (D284), só no Android. Fora dele (iPhone, Expo Go,
// web) não existe e o app usa a notificação do expo-notifications (D173).

export type LiveAction = 'done' | 'skip_rest' | 'plus30';

export type LiveState = {
  title: string;
  body: string;
  /** Descanso (correndo ou pausado): mostra Pular descanso e +30 s */
  resting: boolean;
  /** Fim do descanso correndo, em ms; o Android conta sozinho até lá */
  restEndsAt: number | null;
  /** Como a notificação fica quando o descanso acaba sem o app redesenhar */
  afterTitle: string | null;
  afterBody: string | null;
  afterChip: string | null;
  /** Texto curto do chip da barra de status (Android 16), fora do descanso */
  chip: string | null;
  /** Séries de cada exercício e quantas já foram feitas no total */
  segments: number[];
  progress: number;
  channelName: string;
  doneLabel: string;
  skipRestLabel: string;
  plus30Label: string;
};

declare class WorkoutLiveModule extends NativeModule<{
  onAction: (event: { action: LiveAction }) => void;
}> {
  show(state: LiveState): Promise<void>;
  clear(): Promise<void>;
  canPromote(): boolean;
  openPromotionSettings(): void;
}

export const WorkoutLive = requireOptionalNativeModule<WorkoutLiveModule>('WorkoutLive');
