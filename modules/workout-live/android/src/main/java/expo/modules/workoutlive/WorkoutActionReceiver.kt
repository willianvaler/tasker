package expo.modules.workoutlive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Toque nos botões da notificação do treino, sem destravar e sem abrir o app */
class WorkoutActionReceiver : BroadcastReceiver() {
  companion object {
    const val EXTRA_ACTION = "workoutAction"
    // Os mesmos nomes do WorkoutAction do JS (src/lib/workout-notification.ts)
    const val DONE = "done"
    const val SKIP_REST = "skip_rest"
    const val PLUS_30 = "plus30"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.getStringExtra(EXTRA_ACTION) ?: return
    WorkoutNotification.dispatch(context.applicationContext, action)
  }
}
