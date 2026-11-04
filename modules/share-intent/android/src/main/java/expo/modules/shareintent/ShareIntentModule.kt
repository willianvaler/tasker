package expo.modules.shareintent

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Texto e links que chegam pelo "Compartilhar" de outros apps (PB8, D303). Com o app fechado, o JS
// pede o que veio na abertura (`take`); com ele aberto, o Android entrega um intent novo e vai pelo
// evento `onShare`. Depois de lido, o intent é esvaziado, para não abrir de novo ao voltar ao app.
class ShareIntentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareIntent")
    Events("onShare")

    Function("take") {
      val activity = appContext.currentActivity ?: return@Function null
      read(activity.intent)?.also { activity.intent = Intent(activity.intent).setAction(null) }
    }

    OnNewIntent { intent ->
      read(intent)?.let { shared ->
        intent.action = null
        sendEvent("onShare", shared)
      }
    }
  }

  private fun read(intent: Intent?): Map<String, String?>? {
    if (intent?.action != Intent.ACTION_SEND) return null
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    if (text.isNullOrBlank() && subject.isNullOrBlank()) return null
    return mapOf("text" to text, "title" to subject)
  }
}
