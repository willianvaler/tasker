package expo.modules.shareintent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Texto e links que chegam pelo "Compartilhar" de outros apps (PB8, D303) e, desde o CP1 (D366), uma
// imagem ou um PDF. Com o app fechado, o JS pede o que veio na abertura (`take`); com ele aberto, o
// Android entrega um intent novo e vai pelo evento `onShare`. Depois de lido, o intent é esvaziado,
// para não abrir de novo ao voltar ao app.
//
// O arquivo chega como content:// com permissão só enquanto a atividade vive: ele é copiado para o
// cache do app (shared/), e o JS recebe um file:// que dá para ler depois. Arquivo grande demais não
// é copiado (o JS recebe o tamanho e explica o limite); os de antes saem a cada cópia nova.
class ShareIntentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareIntent")
    Events("onShare")

    Function("take") {
      val activity = appContext.currentActivity ?: return@Function null
      read(activity, activity.intent)?.also { activity.intent = Intent(activity.intent).setAction(null) }
    }

    OnNewIntent { intent ->
      val context = appContext.reactContext ?: return@OnNewIntent
      read(context, intent)?.let { shared ->
        intent.action = null
        sendEvent("onShare", shared)
      }
    }
  }

  private fun read(context: Context, intent: Intent?): Map<String, String?>? {
    if (intent?.action != Intent.ACTION_SEND) return null
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val stream = streamOf(intent)
    if (stream == null) {
      if (text.isNullOrBlank() && subject.isNullOrBlank()) return null
      return mapOf("text" to text, "title" to subject)
    }
    val resolver = context.contentResolver
    val mime = intent.type?.takeIf { it != "*/*" } ?: resolver.getType(stream)
    var name: String? = null
    var size: Long? = null
    try {
      resolver.query(stream, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
        ?.use { c ->
          if (c.moveToFirst()) {
            val n = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val s = c.getColumnIndex(OpenableColumns.SIZE)
            if (n >= 0 && !c.isNull(n)) name = c.getString(n)
            if (s >= 0 && !c.isNull(s)) size = c.getLong(s)
          }
        }
    } catch (_: Exception) {
      // Alguns apps não respondem à consulta: segue com o que der
    }
    val safeName = (name ?: "arquivo").replace(Regex("[^\\w.\\- ]"), "_").take(120)
    var fileUri: String? = null
    if (size == null || size!! <= MAX_COPY) {
      try {
        val dir = File(context.cacheDir, "shared").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val target = File(dir, "${System.currentTimeMillis()}-$safeName")
        var copied = 0L
        resolver.openInputStream(stream)?.use { input ->
          target.outputStream().use { output ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
              val read = input.read(buffer)
              if (read < 0) break
              copied += read
              if (copied > MAX_COPY) break
              output.write(buffer, 0, read)
            }
          }
        }
        if (copied > MAX_COPY) {
          target.delete()
        } else {
          fileUri = Uri.fromFile(target).toString()
        }
        size = copied
      } catch (_: Exception) {
        fileUri = null
      }
    }
    return mapOf(
      "text" to text,
      "title" to subject,
      "fileUri" to fileUri,
      "fileName" to (name ?: safeName),
      "fileMime" to mime,
      "fileSize" to size?.toString(),
    )
  }

  @Suppress("DEPRECATION")
  private fun streamOf(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri

  companion object {
    // Acima disso nem copia: o anexo aceita até 10 MB (imagem maior é reduzida antes de subir)
    const val MAX_COPY = 50L * 1024 * 1024
  }
}
