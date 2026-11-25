# Procesos

Un **proceso** es un flujo que dura: horas, días o semanas. Crea tareas para personas, espera plazos y señales, decide el camino y hace pasos automáticos solo. Es distinto de una **automatización** ("cuando X, haz Y", termina en segundos) y de la pestaña **Flujo** del proyecto (que solo muestra las dependencias de las tareas). Ábrelo en **Ajustes → Abrir los procesos**.

## Glosario

- **Proceso:** el diseño (los pasos y las conexiones). Cada **publicación** crea una **versión**; lo que ya está en curso sigue en la versión con la que empezó.
- **Instancia:** una vez que el proceso se ejecuta, con sus **variables** y su **línea de tiempo**.
- **Paso:** cada caja del diseño.
- **Puerta:** la **decisión** (sigue el primer camino cuya condición es verdadera, o el predeterminado) y el **paralelo** (divide en caminos a la vez y junta cuando todos llegan).
- **Función:** un proceso que otros llaman, con **entradas** y **salidas**. En la lista de Procesos, las funciones quedan en **Avanzado** hasta que crees la primera.

## Los pasos

**Inicio**, **fin** (o fin con error), **paso automático** (las mismas acciones de las automatizaciones: avisar, crear tarea, cambiar la tarea, webhook…), **tarea para alguien**, **decisión**, **paralelo**, **esperar un tiempo** (`PT2H`, `P1D`), **esperar una señal**, **llamar función**, **repetir** (hasta 50 veces) y **para cada elemento** (hasta 100).

La **tarea para alguien** es una tarea normal: aparece en Hoy con la insignia **Proceso**. Puede tener **opciones** ("Aprobar", "Rechazar"), un **formulario** (lo que la persona completa se vuelve variable) y un **plazo**, con recordatorio antes y, si vence, su propio camino, otra persona o solo un aviso. Quien la recibió puede **devolverla al grupo**. Si la persona sale del proyecto, la tarea vuelve al grupo o a ti. **No da XP**, salvo que actives "cuenta como tarea normal".

## Editar, probar y publicar

El diseño se edita en la web: los botones **+** añaden pasos, conectas arrastrando o con el formulario **Conectar dos pasos** (que funciona solo con el teclado), y el panel lateral muestra las propiedades del paso o de la conexión. **Deshacer**, **Rehacer**, **Duplicar** y **Ordenar solo** ayudan. Los errores aparecen al instante, cada uno señalando el paso, y un proceso con errores **no se publica**. **Simular** recorre el diseño con variables de prueba y muestra el camino y las variables, sin hacer nada de verdad (ni aviso, ni webhook). En el móvil, el diseño es solo para ver.

Las condiciones y los cálculos usan el mismo lenguaje del campo calculado, con `{var.nombre}` (variables), `{inicio.*}` (quién lo inició) y `{retorno.*}` (lo que devolvió la última espera). Toda variable usada tiene que estar declarada.

## Empezar desde una nota

En el paso **Inicio**, elige **Empieza cuando**: se crea una nota, cambia una propiedad (por ejemplo `status` pasa a `Estudiando`), se añade una etiqueta o se pulsa un botón de la nota. El proceso queda ligado a la nota, que muestra la tarjeta **Procesos de esta página**. Las acciones de nota (añadir texto al final, definir propiedad, etiquetar, crear desde plantilla) nunca borran lo escrito, y lo que el propio proceso cambia en la nota no lo hace empezar de nuevo. Solo disparan las propiedades guardadas; las calculadas, no.

## Límites

Hasta 200 pasos por diseño, 2.000 pasos por instancia, 365 días, 500 procesos en curso, 60 inicios por hora y 5 funciones una dentro de otra. Un paso que falla puede reintentar (1, 5 y 30 min), seguir por el camino de error o detener el proceso; detenido, **Repetir el paso con fallo** lo intenta otra vez. **Pausar todas** (en Automatizaciones) también pausa los procesos.
