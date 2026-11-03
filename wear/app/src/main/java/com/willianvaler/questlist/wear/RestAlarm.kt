package com.willianvaler.questlist.wear

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

/**
 * Vibração no fim do descanso, com a tela apagada ou o app em segundo plano: alarme exato no
 * `restEndsAt` (o relógio dorme e um timer comum atrasaria até um minuto). Cada mudança do treino
 * reagenda; pular o descanso ou sair do treino cancela.
 */
object RestAlarm {
  private const val EXTRA_END = "restEndsAt"
  @Volatile private var buzzedFor = 0L

  private fun intent(context: Context, end: Long) = PendingIntent.getBroadcast(
    context,
    0,
    Intent(context, RestAlarmReceiver::class.java).putExtra(EXTRA_END, end),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  fun sync(context: Context, state: WorkoutState?) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val end = state?.takeIf { it.resting }?.restEndsAt ?: 0L
    if (end <= System.currentTimeMillis()) {
      alarms.cancel(intent(context, 0))
      return
    }
    val exact = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()
    if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, intent(context, end))
    else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, intent(context, end))
  }

  /** Vibra uma vez por descanso (o alarme e a tela aberta podem chegar juntos) */
  fun buzz(context: Context, end: Long) {
    if (end == buzzedFor) return
    buzzedFor = end
    Buzz.restOver(context)
  }

  fun endFrom(intent: Intent) = intent.getLongExtra(EXTRA_END, 0L)
}

class RestAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val end = RestAlarm.endFrom(intent)
    val app = context.applicationContext
    val known = WorkoutStore.state.value
    if (known != null) {
      if (known.resting && known.restEndsAt == end) RestAlarm.buzz(app, end)
      return
    }
    // O processo foi recriado pelo alarme: confere no item da Data Layer que o descanso ainda vale
    val pending = goAsync()
    Thread {
      try {
        val items = Tasks.await(Wearable.getDataClient(app).dataItems)
        val item = items.firstOrNull { it.uri.path == WorkoutState.PATH }
        val state = item?.let { WorkoutState.from(DataMapItem.fromDataItem(it).dataMap) }
        items.release()
        if (state != null && state.resting && state.restEndsAt == end) RestAlarm.buzz(app, end)
      } catch (_: Exception) {
      } finally {
        pending.finish()
      }
    }.start()
  }
}
