package expo.modules.workoutlive

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

/** Toque no relógio (D287): roda o mesmo caminho dos botões da notificação */
class WearActionService : WearableListenerService() {
  companion object {
    const val ACTION_PATH = "/questlist/action"
  }

  override fun onMessageReceived(event: MessageEvent) {
    if (event.path != ACTION_PATH) return
    val action = String(event.data, Charsets.UTF_8)
    if (action !in setOf(WorkoutActionReceiver.DONE, WorkoutActionReceiver.SKIP_REST, WorkoutActionReceiver.PLUS_30)) return
    WorkoutNotification.dispatch(applicationContext, action)
  }
}
