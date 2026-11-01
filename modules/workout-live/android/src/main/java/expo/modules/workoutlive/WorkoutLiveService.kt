package expo.modules.workoutlive

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ServiceCompat

// Serviço em primeiro plano enquanto o Modo Treino está aberto (D284): com ele o Android não
// congela o app com o celular travado (os botões da notificação rodam e as séries sobem na hora,
// o limite do D173). Não volta sozinho se o sistema o matar (START_NOT_STICKY): sem o app, a
// notificação não teria quem rodasse os botões.
class WorkoutLiveService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = WorkoutNotification.build(this)
    if (notification == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH else 0
    try {
      ServiceCompat.startForeground(this, WorkoutNotification.ID, notification, type)
      WorkoutNotification.serviceRunning = true
    } catch (e: Exception) {
      Log.w("WorkoutLive", "startForeground falhou", e)
      stopSelf()
      WorkoutNotification.post(this)
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    WorkoutNotification.serviceRunning = false
    super.onDestroy()
  }
}
