package com.willianvaler.questlist.wear

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object Buzz {
  private fun vibrator(context: Context): Vibrator? =
    if (Build.VERSION.SDK_INT >= 31)
      context.getSystemService(VibratorManager::class.java)?.defaultVibrator
    else
      @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)

  /** Fim do descanso: três vibrações longas, para sentir no meio da série */
  fun restOver(context: Context) {
    vibrator(context)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 200, 500, 200, 500), -1))
  }

  /** Toque num botão */
  fun tap(context: Context) {
    vibrator(context)?.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
  }
}
