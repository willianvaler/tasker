# Llamar a Questlist desde apps de automatización

Las apps de automatización del móvil (Automate, MacroDroid, Tasker, Atajos del iPhone, Rutinas de Samsung) hacen lo que Questlist no hace: leer SMS, activar No molestar, cambiar el brillo, reaccionar a notificaciones de otras apps. Questlist no toca el sistema del móvil, pero esas apps pueden **llamar** a una de tus automatizaciones, de dos maneras:

- **Dirección de la llamada externa** (webhook de entrada): la app manda un `POST` con datos (el título de una tarea, por ejemplo) y la automatización corre en el servidor, sin abrir nada en pantalla. Necesita una app con acción de **petición HTTP**.
- **Enlace de la automatización** (`/r/…`, el mismo del QR y del NFC): la app solo **abre una dirección**. El navegador abre Questlist, que ejecuta la automatización como tú (pidiendo **Ejecutar** antes, si pide confirmación). Sirve para cualquier app que sepa abrir un sitio.

Los dos están en **Automatizaciones**, en el **Cuando** de la automatización: **Llamada externa (webhook) → Generar dirección**, o **Solo cuando la ejecute → Generar enlace**. Mira el artículo **Automatizaciones**.

## Lo que puede cada app

| App | Petición HTTP (llamada externa) | Abrir el enlace |
|---|---|---|
| Automate (Android) | Sí, bloque **HTTP request** | Sí |
| MacroDroid (Android) | Sí, acción **HTTP Request** | Sí |
| Tasker (Android) | Sí, acción **HTTP Request** | Sí |
| Atajos (iPhone) | Sí, acción **Obtener contenido de URL** | Sí |
| Rutinas de Samsung (Modos y rutinas, antes Bixby Routines) | No tiene | Depende de la versión de One UI; si no está, usa una de las apps de arriba |

Los nombres de los menús cambian con la versión de cada app. Si no lo encuentras, busca "HTTP" o "URL" en la lista de acciones.

## Receta 1: crear una tarea con una petición HTTP

1. En Questlist, crea una automatización con **Cuando: Llamada externa (webhook)** y **Entonces: Crear tarea**. Elige la lista y, en el título, escribe `{{hook.titulo}}`. Guarda y toca **Generar dirección**. Copia la dirección (aparece una sola vez).
2. En la app de automatización, crea una acción de petición HTTP:
   - **Método:** `POST`
   - **Dirección:** la que copiaste
   - **Tipo de contenido:** `application/json`
   - **Cuerpo:** `{"titulo": "Comprar pan"}`
3. Ejecútala. La respuesta es siempre `202`, sin cuerpo (incluso con la dirección equivocada: Questlist no dice si vale). La tarea aparece en la lista elegida; el historial de la automatización muestra cada llamada.

Cualquier campo del cuerpo se vuelve `{{hook.<nombre>}}` en la automatización: `{"titulo": "...", "cuando": "mañana"}` da `{{hook.titulo}}` y `{{hook.cuando}}`. También vale formulario (`application/x-www-form-urlencoded`, `titulo=Comprar pan`), que es lo predeterminado en algunas apps. El cuerpo llega hasta 16 KB y como mucho 4 niveles.

**Una idea:** en MacroDroid o Tasker, el disparador "SMS recibido de tal número" y el cuerpo `{"titulo": "Devolver la llamada a %SMSRF"}` (la variable del remitente, en Tasker). La app lee el SMS; Questlist solo recibe el título.

## Receta 2: ejecutar una automatización abriendo el enlace

1. Crea una automatización con **Cuando: Solo cuando la ejecute** (por ejemplo, "Llegué a casa: abrir la lista Casa y empezar el pomodoro") y toca **Generar enlace**. Copia la dirección `https://…/r/…`.
2. En la app de automatización, usa la acción de **abrir sitio** (o **abrir URL**, **Ver contenido**, **Abrir URL** en Atajos) con esa dirección, y el disparador que quieras: conectarse al Wi-Fi de casa, apagar la alarma, conectarse al coche.
3. Questlist abre en el navegador y ejecuta la automatización. Si pide confirmación, toca **Ejecutar**. Desactiva **Pedir confirmación al abrir** para que corra directo (la automatización que llama a un webhook o a un dispositivo siempre pide).

El enlace solo vale para **tu** cuenta con sesión iniciada; en el móvil se abre en el navegador (todavía no directo en la app).

## Cuidados

- La dirección de la llamada externa y el enlace son como contraseñas. Al compartir un flujo de Automate, un perfil de Tasker o un atajo, quita la dirección antes. ¿Se filtró? Cambiar la dirección o **Cambiar el enlace** invalida la anterior al momento.
- Hay un límite de llamadas por minuto; por encima, la respuesta es `429`. No lo uses para algo que se dispara cada segundo.
- Para aceptar solo llamadas tuyas, activa **Exigir firma** en la automatización y manda el encabezado `X-Questlist-Signature` con el HMAC del cuerpo (mira **Automatizaciones**). La mayoría de estas apps no calcula un HMAC sin un script; si la tuya no puede, déjalo desactivado y guarda bien la dirección.
- Los datos de salud, ubicación, cámara y dispositivo no salen de Questlist por webhook sin que los liberes campo por campo; recibir datos por aquí no cambia eso.
