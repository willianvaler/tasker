package expo.modules.workoutlive

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

// O treino no relógio Wear OS (D287, app em wear/): cada mudança da notificação vai como um item
// da Data Layer, que o relógio lê mesmo se abrir depois. Sair do treino grava active = false.
// Os nomes dos campos são os do WorkoutState do relógio (wear/.../WorkoutState.kt).
object WearSync {
  private const val TAG = "WorkoutLive"
  const val STATE_PATH = "/questlist/workout"

  fun push(context: Context, state: LiveState?) {
    try {
      val request = PutDataMapRequest.create(STATE_PATH).apply {
        dataMap.putBoolean("active", state != null)
        // Muda sempre: a Data Layer não avisa o relógio de um item igual ao anterior
        dataMap.putLong("updatedAt", System.currentTimeMillis())
        if (state != null) {
          dataMap.putString("title", state.title)
          dataMap.putString("body", state.body)
          dataMap.putBoolean("resting", state.resting)
          dataMap.putLong("restEndsAt", state.restEndsAt ?: 0L)
          dataMap.putString("afterTitle", state.afterTitle ?: state.title)
          dataMap.putString("afterBody", state.afterBody ?: state.body)
          dataMap.putInt("total", state.segments.sum())
          dataMap.putInt("progress", state.progress)
          dataMap.putString("doneLabel", state.labels.done)
          dataMap.putString("skipRestLabel", state.labels.skipRest)
          dataMap.putString("plus30Label", state.labels.plus30)
        }
      }.asPutDataRequest().setUrgent()
      Wearable.getDataClient(context).putDataItem(request)
        .addOnFailureListener { Log.d(TAG, "relógio não recebeu o treino", it) }
    } catch (e: Exception) {
      // Sem o Google Play Services (ou sem relógio): o celular segue igual
      Log.d(TAG, "sem Data Layer", e)
    }
  }
}
