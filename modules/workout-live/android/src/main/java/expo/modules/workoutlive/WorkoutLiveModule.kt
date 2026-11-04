package expo.modules.workoutlive

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.lang.ref.WeakReference

// O treino na tela de bloqueio (D284): o que o JS manda a cada mudança da série ou do descanso
class LiveStateRecord : Record {
  @Field val title: String = ""
  @Field val body: String = ""
  /** Descanso (correndo ou pausado): mostra Pular descanso e +30 s */
  @Field val resting: Boolean = false
  /** Fim do descanso correndo (ms desde 1970); o Android conta sozinho até lá */
  @Field val restEndsAt: Double? = null
  /** O texto quando o descanso acaba sozinho (com o app sem redesenhar a notificação) */
  @Field val afterTitle: String? = null
  @Field val afterBody: String? = null
  @Field val afterChip: String? = null
  /** Texto curto do chip na barra de status (Android 16), fora do descanso */
  @Field val chip: String? = null
  /** Séries de cada exercício (os trechos da barra) e quantas já foram feitas no total */
  @Field val segments: List<Int> = emptyList()
  @Field val progress: Int = 0
  @Field val channelName: String = ""
  @Field val doneLabel: String = ""
  @Field val skipRestLabel: String = ""
  @Field val plus30Label: String = ""

  fun toState() = LiveState(
    title = title,
    body = body,
    resting = resting,
    restEndsAt = restEndsAt?.toLong(),
    afterTitle = afterTitle,
    afterBody = afterBody,
    afterChip = afterChip,
    chip = chip,
    segments = segments,
    progress = progress,
    channelName = channelName,
    labels = Labels(doneLabel, skipRestLabel, plus30Label),
  )
}

class WorkoutLiveModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("WorkoutLive")

    Events("onAction")

    OnStartObserving("onAction") {
      val module = WeakReference(this@WorkoutLiveModule)
      WorkoutNotification.listener = { action ->
        module.get()?.sendEvent("onAction", bundleOf("action" to action))
      }
    }

    OnStopObserving("onAction") {
      WorkoutNotification.listener = null
    }

    AsyncFunction("show") { state: LiveStateRecord ->
      WorkoutNotification.show(context, state.toState())
    }

    AsyncFunction("clear") {
      WorkoutNotification.clear(context)
    }

    /** Android 16: a pessoa deixou o app mostrar atualizações ao vivo (vem ligado) */
    Function("canPromote") {
      Build.VERSION.SDK_INT >= 36 && NotificationManagerCompat.from(context).canPostPromotedNotifications()
    }

    /** Abre a tela do sistema que liga as atualizações ao vivo do app */
    Function("openPromotionSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 36) {
        Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Alarme exato (Android 12+): sem ele o aviso do timer atrasa com a tela desligada */
    Function("canExactAlarms") {
      Build.VERSION.SDK_INT < 31 ||
        context.getSystemService(AlarmManager::class.java)?.canScheduleExactAlarms() == true
    }

    /** Abre "Alarmes e lembretes" do app */
    Function("openExactAlarmSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 31) {
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** O app está fora da otimização de bateria (o Android Go congela os otimizados) */
    Function("ignoresBatteryOptimizations") {
      context.getSystemService(PowerManager::class.java)
        ?.isIgnoringBatteryOptimizations(context.packageName) == true
    }

    /** Abre a lista de otimização de bateria (sem pedir a permissão restrita da Play) */
    Function("openBatterySettings") {
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      } catch (e: Exception) {
        context.startActivity(
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }
  }
}
