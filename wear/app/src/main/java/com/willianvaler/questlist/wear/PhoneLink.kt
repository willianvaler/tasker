package com.willianvaler.questlist.wear

import android.content.Context
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await

/** Os botões do relógio vão ao celular por mensagem (WearActionService do modules/workout-live) */
object PhoneLink {
  private const val ACTION_PATH = "/questlist/action"
  const val DONE = "done"
  const val SKIP_REST = "skip_rest"
  const val PLUS_30 = "plus30"

  /** false: nenhum celular conectado recebeu */
  suspend fun send(context: Context, action: String): Boolean {
    return try {
      val nodes = Wearable.getNodeClient(context).connectedNodes.await()
      var sent = false
      for (node in nodes) {
        try {
          Wearable.getMessageClient(context)
            .sendMessage(node.id, ACTION_PATH, action.toByteArray(Charsets.UTF_8)).await()
          sent = true
        } catch (_: Exception) {}
      }
      sent
    } catch (_: Exception) {
      false
    }
  }
}
