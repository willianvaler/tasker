package com.willianvaler.questlist.wear

import android.content.Context
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await

/**
 * O treino como o celular mandou (D287): os mesmos textos da notificação da tela de bloqueio
 * (modules/workout-live, WearSync.kt, com os mesmos nomes de campo).
 */
data class WorkoutState(
  val title: String,
  val body: String,
  val resting: Boolean,
  /** Fim do descanso correndo (ms desde 1970); 0: sem descanso ou pausado */
  val restEndsAt: Long,
  val afterTitle: String,
  val afterBody: String,
  val total: Int,
  val progress: Int,
  val doneLabel: String,
  val skipRestLabel: String,
  val plus30Label: String,
  val updatedAt: Long,
) {
  /** Como fica quando o descanso acaba sem o celular mandar nada (volta para a série) */
  fun at(now: Long): WorkoutState =
    if (resting && restEndsAt in 1..now)
      copy(title = afterTitle, body = afterBody, resting = false, restEndsAt = 0)
    else this

  companion object {
    const val PATH = "/questlist/workout"
    // Treino aberto há mais que isso sem mudança: o app do celular morreu sem avisar
    private const val STALE_MS = 3 * 60 * 60 * 1000L

    fun from(map: DataMap): WorkoutState? {
      if (!map.getBoolean("active")) return null
      val updatedAt = map.getLong("updatedAt")
      if (System.currentTimeMillis() - updatedAt > STALE_MS) return null
      val title = map.getString("title") ?: ""
      val body = map.getString("body") ?: ""
      return WorkoutState(
        title = title,
        body = body,
        resting = map.getBoolean("resting"),
        restEndsAt = map.getLong("restEndsAt"),
        afterTitle = map.getString("afterTitle") ?: title,
        afterBody = map.getString("afterBody") ?: body,
        total = map.getInt("total"),
        progress = map.getInt("progress"),
        doneLabel = map.getString("doneLabel") ?: "Feita",
        skipRestLabel = map.getString("skipRestLabel") ?: "Pular",
        plus30Label = map.getString("plus30Label") ?: "+30 s",
        updatedAt = updatedAt,
      )
    }
  }
}

/** O treino de agora, para a tela e para o aviso fixo; quem escreve é o listener e a abertura do app */
object WorkoutStore {
  private val flow = MutableStateFlow<WorkoutState?>(null)
  val state: StateFlow<WorkoutState?> = flow

  fun set(context: Context, next: WorkoutState?) {
    flow.value = next
    OngoingNotice.update(context.applicationContext, next)
    RestAlarm.sync(context.applicationContext, next)
  }

  /** O último item que o celular gravou (a Data Layer guarda, mesmo com o relógio desligado) */
  suspend fun load(context: Context) {
    val items = Wearable.getDataClient(context).dataItems.await()
    try {
      val item = items.firstOrNull { it.uri.path == WorkoutState.PATH }
      set(context, item?.let { WorkoutState.from(DataMapItem.fromDataItem(it).dataMap) })
    } finally {
      items.release()
    }
  }
}
