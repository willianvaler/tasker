# Organizar el día y automatizar

- **Mi día** — elige lo que harás hoy (`M` o en el panel), ordénalo y di cuánto tiempo tienes: la app muestra si cabe.
- **Hacer ahora** — la sugerencia de qué hacer después: lo que ya empezó, tu día, lo atrasado.
- **Posponer** — el despertador de la fila (o `Z`) la lleva a mañana.
- **Campos** — en el menú de la lista, crea campos como Valor, Fase o Comprador. El tipo **Calculado** hace cuentas con los demás: `{Precio} * {Cantidad}`, `dias_hasta({vencimiento})`, `si({Fase} = "Compra", 1, 0)`. Valen números, `+ - * /`, comparaciones (`=`, `!=`, `<`, `>`, `<=`, `>=`), texto entre comillas y las funciones `si`, `dias_hasta`, `hoy`, `redondear`, `min`, `max`, `abs`, `y`, `o`, `no` y `vacio` (también en portugués e inglés). Además de los campos de la lista, la fórmula lee `{titulo}`, `{vencimiento}`, `{inicio}`, `{prioridad}`, `{estimacion}`, `{tiempo}` y `{completada}`. El valor se calcula al momento; no se escribe. En una tarea con subtareas, los campos de número muestran **el total de las hijas**, y el tiempo, lo registrado en ellas.
- **Aprobación** — una tarea que solo una persona (o quien gestiona) puede completar: el dueño aprueba el presupuesto antes de comprar.

## Automatizaciones

En un proyecto, **Automatizaciones** crea reglas "cuando… entonces…". Ejemplo: cuando se complete una tarea de la lista Día, crear "Limpiar la parrilla" en la lista Después. Hasta 20 por proyecto. La regla se ejecuta en el servidor unos segundos después de lo que la activó, con los permisos de quien la creó; si una acción no puede ejecutarse (esa persona salió del proyecto, la lista ya no existe), aparece en las últimas ejecuciones y no se pierde nada.

## Matriz de Eisenhower

En una lista de tareas, las pestañas de arriba cambian la vista: **Lista**, **Tablero** (el kanban, con las columnas Por hacer, Haciendo y Hecho) y **Matriz**. La **Matriz** separa las tareas abiertas en cuatro cuadrantes: **Hacer** (importante y urgente), **Programar** (importante, sin prisa), **Delegar** (urgente, poco importante) y **Eliminar** (ni lo uno ni lo otro). Importante es prioridad `!!` o `!!!`; urgente es lo que vence hasta pasado mañana, incluidas las atrasadas. El botón junto a la tarea cambia el cuadrante: ajusta la prioridad y, si hace falta, la fecha (vence hoy, o dentro de una semana). La lista recuerda la última pestaña usada en este dispositivo.

## Vistas guardadas

El **+** junto a las pestañas crea una **vista** de la misma lista, sin copiar nada: un nombre, cómo verla (**Lista**, **Tablero**, **Tabla**, **Calendario** o **Gantt**), qué tareas entran (abiertas o completadas, atrasadas, de los próximos 7 días, sin fecha, con una etiqueta, solo las asignadas a ti), el orden y el agrupamiento. La vista se vuelve una pestaña.

- **Tablero por campo:** agrupa por prioridad, responsable, etiqueta o un campo de selección (ej.: Fase). Arrastrar la tarjeta a otra columna (o usar las flechas) cambia ese valor en la tarea; por estado, es el tablero de siempre.
- **Tabla:** elige las columnas, incluidos los campos de la lista. Toca una celda para editarla (título, fechas, prioridad, etiquetas y campos); el encabezado ordena.
- **Calendario:** el mes con las tareas por vencimiento; las que no tienen fecha quedan abajo.
- **Gantt:** las barras del inicio al vencimiento, solo de esta lista.

En un proyecto, la vista puede ser **Solo yo** (solo tú la ves) o **Todo el proyecto** (todos la ven; crearla y cambiarla pide poder configurar listas). El botón de ajustes junto a las pestañas cambia o borra la vista abierta.

En el **pie de la tabla** (en las vistas y en las Bases) está el total de cada columna: en las de número y dinero, la suma; toca para cambiar a promedio, mínimo, máximo, cuántas están rellenas o nada. En las de valor (estado, etiqueta, selección), el toque muestra cuántas tareas hay de cada uno. En la tabla, la madre sin valor muestra la suma de las subtareas con **Σ** delante.

## Revisión semanal

Una vez por semana, Hoy sugiere la **Revisión semanal**; siempre está en **Planificar** (y en la búsqueda, `Ctrl+K`). Son cuatro pasos: **Hecho** (lo que hiciste en los últimos 7 días, por lista), **Quedó** (las atrasadas: elige un día nuevo, quita la fecha o complétalas), **Parado** (sin fecha y sin tocar hace más de 30 días: dale una fecha o archívala, que va a la papelera) y **Próxima semana** (lo que vence en los próximos 7 días). **Terminar revisión** guarda la fecha; "Ahora no" esconde el aviso por una semana.
