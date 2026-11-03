package com.willianvaler.questlist.wear

import android.Manifest
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.wear.ambient.AmbientLifecycleObserver
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Date

// Laranja do app (o mesmo da notificação do celular, ACCENT do WorkoutNotification.kt)
private val Accent = Color(0xFFFF8A3D)

/**
 * O treino no pulso (D287): exercício e série, Feita grande, contagem do descanso com Pular e
 * +30 s. Quem decide é o celular: o toque vai por mensagem e a tela muda quando o estado novo
 * chega. Em modo ambiente (tela apagada com o app aberto) só texto, sem botões.
 */
class MainActivity : ComponentActivity() {
  private var ambient by mutableStateOf(false)
  private var ambientTick by mutableLongStateOf(0L)

  private val ambientObserver = AmbientLifecycleObserver(
    this,
    object : AmbientLifecycleObserver.AmbientLifecycleCallback {
      override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
        ambient = true
      }

      override fun onExitAmbient() {
        ambient = false
      }

      override fun onUpdateAmbient() {
        ambientTick = System.currentTimeMillis()
      }
    },
  )

  private val askNotifications =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      if (granted) OngoingNotice.update(applicationContext, WorkoutStore.state.value)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    lifecycle.addObserver(ambientObserver)
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    demo()
    setContent {
      MaterialTheme {
        WorkoutScreen(ambient = ambient, ambientTick = ambientTick)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    demo()
  }

  override fun onStart() {
    super.onStart()
    if (demo()) return
    lifecycleScope.launch {
      try {
        WorkoutStore.load(applicationContext)
      } catch (_: Exception) {}
    }
  }

  /**
   * Só no build de debug, para ver a tela no emulador sem o celular:
   * adb shell am start -n com.willianvaler.questlist/.wear.MainActivity --es demo rest (ou set)
   */
  private fun demo(): Boolean {
    if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return false
    val kind = intent?.getStringExtra("demo") ?: return false
    val now = System.currentTimeMillis()
    WorkoutStore.set(
      applicationContext,
      WorkoutState(
        title = "Supino reto",
        body = if (kind == "rest") "Descanso · depois: Supino reto, série 3 de 4" else "Série 2 de 4 · 10 × 40 kg",
        resting = kind == "rest",
        restEndsAt = if (kind == "rest") now + 15_000 else 0,
        afterTitle = "Supino reto",
        afterBody = "Série 3 de 4 · 10 × 40 kg",
        total = 16,
        progress = 5,
        doneLabel = "Feita",
        skipRestLabel = "Pular descanso",
        plus30Label = "+30 s",
        updatedAt = now,
      ),
    )
    return true
  }
}

@Composable
private fun WorkoutScreen(ambient: Boolean, ambientTick: Long) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val received by WorkoutStore.state.collectAsState()
  var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
  var unreachable by remember { mutableStateOf(false) }

  // Contagem do descanso: 4 vezes por segundo com a tela acesa; no ambiente, a cada minuto
  LaunchedEffect(received, ambient, ambientTick) {
    now = System.currentTimeMillis()
    while (!ambient && received?.resting == true && (received?.restEndsAt ?: 0L) > 0L) {
      delay(250)
      now = System.currentTimeMillis()
      val end = received?.restEndsAt ?: 0L
      if (end in 1..now) {
        RestAlarm.buzz(context.applicationContext, end)
        break
      }
    }
  }

  fun send(action: String) {
    Buzz.tap(context)
    scope.launch {
      unreachable = !PhoneLink.send(context.applicationContext, action)
      if (unreachable) {
        delay(3000)
        unreachable = false
      }
    }
  }

  val state = received?.at(now)
  Scaffold(
    modifier = Modifier.background(Color.Black),
    timeText = { if (!ambient) TimeText() },
  ) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
      if (state != null && state.total > 0 && !ambient) {
        CircularProgressIndicator(
          progress = state.progress.toFloat() / state.total,
          modifier = Modifier.fillMaxSize().padding(2.dp),
          startAngle = 300f,
          endAngle = 240f,
          indicatorColor = Accent,
          strokeWidth = 4.dp,
        )
      }
      when {
        state == null -> Waiting()
        state.resting -> Resting(state, now, ambient, ::send)
        else -> SetScreen(state, ambient, ::send)
      }
      if (unreachable) {
        Text(
          stringResource(R.string.unreachable),
          modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp),
          style = MaterialTheme.typography.caption3,
          color = Color(0xFFFFB4A9),
        )
      }
    }
  }
}

@Composable
private fun Waiting() {
  Column(
    Modifier.padding(horizontal = 24.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(
      stringResource(R.string.waiting_title),
      style = MaterialTheme.typography.title3,
      textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(8.dp))
    Text(
      stringResource(R.string.waiting_body),
      style = MaterialTheme.typography.caption2,
      textAlign = TextAlign.Center,
      color = Color.LightGray,
    )
  }
}

@Composable
private fun SetScreen(state: WorkoutState, ambient: Boolean, send: (String) -> Unit) {
  Column(
    Modifier.padding(horizontal = 20.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(
      state.title,
      style = MaterialTheme.typography.title3,
      textAlign = TextAlign.Center,
      maxLines = 2,
      overflow = TextOverflow.Ellipsis,
    )
    Text(
      state.body,
      style = MaterialTheme.typography.caption2,
      textAlign = TextAlign.Center,
      color = Color.LightGray,
      maxLines = 2,
      overflow = TextOverflow.Ellipsis,
    )
    Spacer(Modifier.height(8.dp))
    if (!ambient) {
      Button(
        onClick = { send(PhoneLink.DONE) },
        modifier = Modifier.size(84.dp),
        colors = ButtonDefaults.buttonColors(backgroundColor = Accent, contentColor = Color.Black),
      ) {
        Text(state.doneLabel, fontSize = 18.sp, fontWeight = FontWeight.Bold)
      }
    }
    if (state.total > 0) {
      Spacer(Modifier.height(4.dp))
      Text(
        stringResource(R.string.progress, state.progress, state.total),
        style = MaterialTheme.typography.caption3,
        color = Color.LightGray,
      )
    }
  }
}

@Composable
private fun Resting(state: WorkoutState, now: Long, ambient: Boolean, send: (String) -> Unit) {
  val context = LocalContext.current
  val left = ((state.restEndsAt - now + 999) / 1000).coerceAtLeast(0)
  val countdown = when {
    state.restEndsAt == 0L -> stringResource(R.string.paused)
    // No ambiente a tela só redesenha a cada minuto: mostra até que horas, não os segundos
    ambient -> stringResource(R.string.until, DateFormat.getTimeFormat(context).format(Date(state.restEndsAt)))
    else -> "%d:%02d".format(left / 60, left % 60)
  }
  Column(
    Modifier.padding(horizontal = 20.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(stringResource(R.string.rest), style = MaterialTheme.typography.caption1, color = Accent)
    Text(
      countdown,
      fontSize = if (ambient || state.restEndsAt == 0L) 24.sp else 44.sp,
      fontWeight = FontWeight.Bold,
      modifier = Modifier.semantics { contentDescription = countdown },
    )
    Text(
      state.body,
      style = MaterialTheme.typography.caption2,
      textAlign = TextAlign.Center,
      color = Color.LightGray,
      maxLines = 2,
      overflow = TextOverflow.Ellipsis,
    )
    if (!ambient) {
      Spacer(Modifier.height(8.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(
          onClick = { send(PhoneLink.SKIP_REST) },
          modifier = Modifier.size(ButtonDefaults.DefaultButtonSize),
          colors = ButtonDefaults.secondaryButtonColors(),
        ) {
          Text(stringResource(R.string.skip), fontSize = 13.sp)
        }
        Button(
          onClick = { send(PhoneLink.PLUS_30) },
          modifier = Modifier.size(ButtonDefaults.DefaultButtonSize),
          colors = ButtonDefaults.secondaryButtonColors(),
        ) {
          Text(state.plus30Label, fontSize = 13.sp)
        }
      }
    }
  }
}
