package expo.modules.workoutlive

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

data class Labels(val done: String, val skipRest: String, val plus30: String)

data class LiveState(
  val title: String,
  val body: String,
  val resting: Boolean,
  val restEndsAt: Long?,
  val afterTitle: String?,
  val afterBody: String?,
  val afterChip: String?,
  val chip: String?,
  val segments: List<Int>,
  val progress: Int,
  val channelName: String,
  val labels: Labels,
) {
  /** Como fica quando o descanso acaba: volta para a série, só com o Feita */
  fun afterRest() = copy(
    title = afterTitle ?: title,
    body = afterBody ?: body,
    chip = afterChip ?: chip,
    resting = false,
    restEndsAt = null,
  )
}

// A notificação do treino (D284): uma só, sempre com o mesmo id, montada aqui e mostrada pelo
// serviço em primeiro plano (WorkoutLiveService). No descanso o Android conta o tempo sozinho
// (cronômetro regressivo, também no chip da barra de status do Android 16); a barra mostra as
// séries do treino, um trecho por exercício. Os botões chegam ao JS pelo WorkoutActionReceiver.
object WorkoutNotification {
  private const val TAG = "WorkoutLive"
  const val ID = 7301
  private const val CHANNEL = "workout_live"
  // O canal antigo (expo-notifications, D173): sai para não ficarem dois "Treino" nos ajustes
  private const val OLD_CHANNEL = "workout"
  // Grupo só dela: sem isso o Android junta com o aviso do fim do descanso e ela vira uma linha
  private const val GROUP = "questlist_workout_live"
  // Mais trechos que isso a barra não mostra bem: vira um trecho só
  private const val MAX_SEGMENTS = 12
  private const val ACCENT = 0xFFFF8A3D.toInt()

  @Volatile var current: LiveState? = null
    private set
  @Volatile var serviceRunning = false
  @Volatile var listener: ((String) -> Unit)? = null

  private val main = Handler(Looper.getMainLooper())
  private var restEnd: Runnable? = null

  fun show(context: Context, state: LiveState) {
    val app = context.applicationContext
    if (!canNotify(app)) return
    ensureChannel(app, state.channelName)
    current = state
    scheduleRestEnd(app, state)
    if (serviceRunning) {
      post(app)
      return
    }
    try {
      ContextCompat.startForegroundService(app, Intent(app, WorkoutLiveService::class.java))
    } catch (e: Exception) {
      // Começar o serviço com o app em segundo plano é proibido (Android 12+): fica a notificação comum
      Log.w(TAG, "serviço não iniciou", e)
      post(app)
    }
  }

  fun clear(context: Context) {
    val app = context.applicationContext
    current = null
    restEnd?.let(main::removeCallbacks)
    restEnd = null
    app.stopService(Intent(app, WorkoutLiveService::class.java))
    NotificationManagerCompat.from(app).cancel(ID)
  }

  /** Toque num botão: avisa o JS, que roda a mesma ação da tela; o descanso muda já na notificação */
  fun dispatch(context: Context, action: String) {
    val handler = listener ?: return
    val state = current
    if (state != null && state.resting) {
      when (action) {
        WorkoutActionReceiver.SKIP_REST -> update(context, state.afterRest())
        WorkoutActionReceiver.PLUS_30 ->
          state.restEndsAt?.let { update(context, state.copy(restEndsAt = it + 30_000)) }
      }
    }
    main.post { handler(action) }
  }

  private fun update(context: Context, state: LiveState) {
    current = state
    scheduleRestEnd(context, state)
    post(context)
  }

  @SuppressLint("MissingPermission")
  fun post(context: Context) {
    val notification = build(context) ?: return
    if (canNotify(context)) NotificationManagerCompat.from(context).notify(ID, notification)
  }

  private fun canNotify(context: Context): Boolean {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
    return Build.VERSION.SDK_INT < 33 ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
  }

  /** No fim do descanso a notificação volta para a série, mesmo que o JS esteja parado */
  private fun scheduleRestEnd(context: Context, state: LiveState) {
    restEnd?.let(main::removeCallbacks)
    restEnd = null
    val end = state.restEndsAt ?: return
    val task = Runnable {
      val now = current
      if (now != null && now.restEndsAt == end) update(context, now.afterRest())
    }
    restEnd = task
    main.postDelayed(task, (end - System.currentTimeMillis()).coerceAtLeast(0))
  }

  private fun ensureChannel(context: Context, name: String) {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    manager.deleteNotificationChannel(OLD_CHANNEL)
    // DEFAULT, e não LOW: o Android esconde as silenciosas da tela de bloqueio; o som fica desligado
    val channel = NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  fun build(context: Context): Notification? {
    val state = current ?: return null
    val now = System.currentTimeMillis()
    val counting = state.restEndsAt != null && state.restEndsAt > now
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.workout_live_icon)
      .setColor(ACCENT)
      .setContentTitle(state.title)
      .setContentText(state.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(state.body))
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setGroup(GROUP)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setRequestPromotedOngoing(true)
      .setContentIntent(openApp(context))

    if (counting) {
      builder.setWhen(state.restEndsAt!!).setShowWhen(true)
        .setUsesChronometer(true).setChronometerCountDown(true)
    } else {
      builder.setShowWhen(false)
      state.chip?.let(builder::setShortCriticalText)
    }

    val total = state.segments.sum()
    if (total > 0) {
      val done = state.progress.coerceIn(0, total)
      if (Build.VERSION.SDK_INT >= 36) {
        val segments = if (state.segments.size > MAX_SEGMENTS) listOf(total) else state.segments
        builder.setStyle(
          NotificationCompat.ProgressStyle()
            .setStyledByProgress(true)
            .setProgressSegments(segments.map { NotificationCompat.ProgressStyle.Segment(it).setColor(ACCENT) })
            .setProgress(done),
        )
      } else {
        builder.setProgress(total, done, false)
      }
    }

    if (state.resting) {
      builder.addAction(0, state.labels.skipRest, action(context, WorkoutActionReceiver.SKIP_REST))
      builder.addAction(0, state.labels.plus30, action(context, WorkoutActionReceiver.PLUS_30))
    }
    builder.addAction(0, state.labels.done, action(context, WorkoutActionReceiver.DONE))
    return builder.build()
  }

  private fun action(context: Context, name: String): PendingIntent {
    val intent = Intent(context, WorkoutActionReceiver::class.java)
      .setAction(name)
      .putExtra(WorkoutActionReceiver.EXTRA_ACTION, name)
    return PendingIntent.getBroadcast(
      context,
      name.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Tocar na notificação traz o app de volta (com o treino aberto) */
  private fun openApp(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
