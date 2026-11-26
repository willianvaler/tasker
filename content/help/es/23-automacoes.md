# Automatizaciones

Una **automatización** es una regla "cuando… si… entonces…": **cuando** pasa algo (el disparador), **si** se cumplen las condiciones, **entonces** la app hace los pasos sola, en el servidor. Las tuyas están en **Ajustes → Automatizaciones**; las de un proyecto, en el menú del proyecto (**Automatizaciones**), para quien puede gestionarlas.

## Cuando: el disparador

En el editor, los disparadores aparecen en grupos: Tareas, Tiempo, Notas, Juego y De fuera.

- **Tareas:** creada, completada, lista para empezar (lo que esperaba ya se hizo), asignada a ti, atrasada o a punto de vencer. **Lista completa terminada.**
- **Juego y proyecto:** subiste de nivel, jefe derrotado, hito alcanzado.
- **Reloj:** a una hora (con los días de la semana) o cada N horas, siempre en tu zona horaria.
- **Llamada externa (webhook):** una dirección solo para esta automatización; lo que llegue se vuelve `hook.*`.
- **Solo cuando la ejecute:** se ejecuta con el botón **Ejecutar ahora**.

Importar de Habitica o de Todoist y usar una plantilla no disparan ninguna automatización.

## Si: las condiciones

Opcional. Combina con **Y** (todas), **O** (alguna) y **NO**, hasta 3 niveles y 10 comparaciones. Hay condiciones listas — **franja horaria** (de 22:00 a 06:00 cruza la medianoche), **días de la semana**, **proyecto**, **lista**, **etiqueta** y **nivel mínimo** — y la comparación de un valor (`evento.titulo` contiene "factura", `evento.prioridade` ≥ 2). Si no se cumplen, la ejecución aparece en el historial como "condiciones: no".

## Entonces: los pasos

Hasta 20 pasos: **avisar** (en la app, en el móvil o en los dos), **crear tarea** (vencimiento como fecha o `+2` días), **cambiar la tarea** (etiquetas, lista y vencimiento), **asignar** (en el proyecto), **empezar descanso**, **esperar** (de 1 minuto a 7 días), **guardar un valor**, **si… si no**, **ejecutar otra automatización**, **llamar a una URL (webhook)**, **cambiar el modo juego** y **detener**. Una automatización nunca completa, reabre ni borra tareas.

En los textos, `{{evento.titulo}}` se reemplaza por el valor. Filtros: `|corta:40`, `|data`, `|hora` y `|padrao:"sin nombre"`. También valen `{{usuario.nome}}`, `{{usuario.nivel}}`, `{{agora|hora}}` y `{{var.nombre}}` (un valor guardado antes). Una variable que no existe queda vacía y deja un aviso en el historial. Los nombres en inglés y español también funcionan (`{{evento.titulo|recorta:40}}`).

La automatización actúa **como quien la creó**: solo hace lo que esa persona puede. Si sale del proyecto, la acción falla y queda en el historial.

## Probar, ejecutar y el historial

**Probar** muestra lo que haría cada paso, con un ejemplo del disparador, sin hacer nada de verdad (ni avisar, ni crear, ni llamar). **Ejecutar ahora** la ejecuta de verdad. El **historial** muestra las últimas 50 ejecuciones, paso a paso, con el error cuando lo hay.

## Límites

Cada automatización se ejecuta hasta **60 veces por hora**, y todas las tuyas juntas, **600**; avisos, hasta **10 por hora** por automatización. Pasado eso, la ejecución queda como **limitada** (no es un error). El uso de la hora aparece en Automatizaciones cuando se acerca al límite (80%). Una automatización que falla **10 veces seguidas** se apaga y recibes un aviso; enciéndela de nuevo después de corregirla. Un disparo que se atrase más de 15 minutos (servidor caído) no se ejecuta y queda como **perdido**. **Pausar todas** detiene todo al instante, incluso lo que estaba esperando.

## Llamar a una URL (webhook de salida)

Sirve para Discord (el webhook del canal), un Home Assistant expuesto a internet, IFTTT y cualquier servicio con dirección **https://**. El cuerpo es un JSON, y los textos dentro aceptan `{{ }}`. Las contraseñas y tokens de cabecera (`Authorization`) se guardan aparte, cifrados, y no vuelven a la pantalla. Las direcciones de tu red de casa y del propio servidor están bloqueadas.

Con **Firmar**, cada llamada lleva `X-Questlist-Signature: t=<segundos>,v1=<firma>`, un HMAC-SHA256 del texto `t` + `.` + cuerpo, con el secreto de firma (mostrado una vez, al generarlo). Para comprobarla en tu servidor (Node):

```js
const crypto = require('crypto');
function comprueba(cabecera, cuerpo, secreto) {
  const { t, v1 } = Object.fromEntries(cabecera.split(',').map((p) => p.split('=')));
  const esperado = crypto.createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest('hex');
  const reciente = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return reciente && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(esperado));
}
```

Cada llamada lleva también `X-Questlist-Idempotency`: si llega dos veces con el mismo valor, es la misma llamada.

### Receta: avisar en un canal de Discord

1. En Discord, abre **Editar canal → Integraciones → Webhooks → Nuevo webhook**, ponle un nombre y toca **Copiar URL del webhook**.
2. En Questlist, en **Configuración → Automatizaciones**, elige la plantilla **Avisar en Discord al subir de nivel** o **Avisar en Discord al vencer a un jefe**.
3. En **Entonces**, pega la dirección copiada en lugar de `https://discord.com/api/webhooks/` y ajusta el texto de `content` (acepta `{{evento.nivel}}` y `{{evento.boss_nome}}`).
4. **Probar** muestra lo que se enviaría sin enviar nada; **Guardar** enciende la automatización.

Discord muestra el mensaje con el nombre del webhook. La dirección del webhook es como una contraseña: quien la tenga publica en el canal. Si se filtra, borra el webhook en Discord y crea otro. Ningún dato sensible (salud, ubicación, cámara, dispositivo) entra en el mensaje.

### Datos sensibles

Salud, ubicación, cámara y dispositivo (`{{saude.…}}`, `{{local.…}}`, `{{camera.…}}`, `{{dispositivo.…}}`) **no salen** en un webhook: la automatización se detiene con el aviso "Dato sensible bloqueado" en el historial. Para mandar un campo, libéralo en **Configuración → Tus datos → Datos sensibles en automatizaciones** (ej.: `saude.agua.ml`; liberar `saude.agua` vale para todo lo que contiene). Los procesos nunca mandan datos sensibles.

## Recibir una llamada (webhook de entrada)

En una automatización con el disparador **Llamada externa**, **Generar dirección** muestra la dirección **una vez** (guárdala). Envía un `POST` con JSON o formulario, hasta 16 KB; la respuesta es siempre `202`, sin cuerpo. **Cambiar dirección** invalida la anterior al instante. Hay un límite de llamadas por minuto; por encima, la respuesta es `429`.

## Enlace por QR y NFC

Una automatización personal con el disparador **manual** puede tener un enlace: en **Cuando**, toca **Generar enlace**. La dirección y el QR aparecen una sola vez; usa **Imprimir el QR** para pegarlo en la puerta, el escritorio o el coche. Para NFC, graba la misma dirección en una etiqueta con cualquier app de grabación: al acercar el móvil, el sistema abre el enlace, sin instalar nada en Questlist.

Al abrir el enlace, Questlist te pide entrar (si hace falta) y ejecuta la automatización como tú. Solo tu cuenta usa el enlace: para otra persona aparece como no válido. Por defecto la pantalla pide **Ejecutar** antes; apaga **Pedir confirmación al abrir** para que se ejecute directo. Una automatización que llama a un webhook o a un dispositivo **siempre** pide confirmación. **Cambiar el enlace** o **Revocar** hace que los QR y las etiquetas antiguas dejen de funcionar al instante. En Android, el enlace se abre en el navegador, donde ya tienes la sesión de Questlist.

## Notas

Creada, propiedad cambiada, etiqueta añadida y botón pulsado son disparadores; añadir texto, definir propiedad, etiquetar, crear desde plantilla e **iniciar un proceso** son acciones. Ninguna acción borra texto.
