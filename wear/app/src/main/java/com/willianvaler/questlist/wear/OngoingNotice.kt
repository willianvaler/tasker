package com.willianvaler.questlist.wear

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status

/**
 * Treino aberto no celular: aviso fixo com Ongoing Activity, que põe o ícone no mostrador e faz o
 * relógio voltar para o app ao levantar o pulso (como os apps de exercício do sistema).
 */
object OngoingNotice {
  private const val CHANNEL = "workout"
  private const val ID = 7302

  fun update(context: Context, state: WorkoutState?) {
    val manager = NotificationManagerCompat.from(context)
    if (state == null) {
      manager.cancel(ID)
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) return
    context.getSystemService(NotificationManager::class.java)?.createNotificationChannel(
      NotificationChannel(CHANNEL, context.getString(R.string.channel), NotificationManager.IMPORTANCE_LOW),
    )
    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.ic_workout)
      .setContentTitle(state.title)
      .setContentText(state.body)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setOngoing(true)
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(open)
    OngoingActivity.Builder(context, ID, builder)
      .setStaticIcon(R.drawable.ic_workout)
      .setTouchIntent(open)
      .setStatus(Status.Builder().addTemplate(state.title).build())
      .build()
      .apply(context)
    manager.notify(ID, builder.build())
  }
}
