# Carpetas, proyectos y listas

- Una **lista** guarda tus cosas: compras, entrenamiento, plan de viaje. El tipo puede ser **Tareas**, **Rutina** (checklist en tarjetas que se reinicia; buena para entrenar), **Hábitos**, **Tablero**, **Gastos** o **Base** (ver Notas). Toda lista de tareas también se abre como **Tablero** (pestaña arriba). En el tablero, arrastra la tarjeta a otra columna (en el móvil, mantenla pulsada antes de arrastrar) o usa las flechas de la tarjeta. Para abrir la tarea, toca el lápiz de la tarjeta.
- Una **carpeta** agrupa tus listas. Ejemplo: la carpeta **Gimnasio** con Entrenamiento A y B.
- Un **proyecto** es una carpeta para hacer **con otras personas**. Ejemplo: el proyecto **Asado** con las listas Compras y Día, cada amigo con sus tareas.

## Cuándo usar cada uno

- Solo tú, algo que se repite: **carpeta**.
- Más gente, algo con inicio y fin: **proyecto**.
- Un entrenamiento para un alumno, un menú para un paciente: **envía la lista** (ver "Enviar una lista").

## Reinicio

Una lista puede **reiniciar** sus marcas cada día, cada semana o cuando digas. Ideal para entrenamientos semanales y rutinas.

## Mover

En el menú de la lista, **Mover a…** lleva la lista (con sus tareas) a otra carpeta o proyecto.

Para cambiar el orden sin arrastrar, usa **Mover arriba** y **Mover abajo** en el menú de la carpeta o de la lista (en el teclado, **Alt+↑** y **Alt+↓** con ella abierta).

## Gimnasio

Si respondiste que vas a usar la app para entrenar (o activaste **Entrenamiento** en Ajustes → Funciones), la barra lateral gana el bloque **Gimnasio**, con tus entrenamientos. **+ Nuevo entrenamiento** crea la lista de entrenamiento ahí mismo, ya en tarjetas y reiniciándose cada semana. Desactivar el modo no borra nada: la carpeta Gimnasio vuelve a Carpetas.

## Barra lateral

En **Ajustes → Navegación** cambias el orden de los bloques (Notas, Carpetas, Gimnasio, Proyectos, Recibidas) y ocultas los que no usas. Vale en todos tus dispositivos.

En la computadora, arrastra el **borde derecho** de la barra para cambiar el ancho, y la **línea entre los accesos** (Hoy, Planificar…) **y los bloques** para dar más lugar a las carpetas y notas: los accesos se achican y se desplazan por dentro. Doble clic en la línea vuelve a mostrarlos todos.

En la computadora, el **clic derecho** en una carpeta (en la barra lateral o en la pestaña Carpetas), una lista, un proyecto, un hito o un medicamento abre el mismo menú que el botón **…** de la fila.

## Notas

**Nueva nota** (barra lateral, menú **+** o Más → Notas) abre un texto libre, solo tuyo. La barra de arriba da formato: **negrita**, _cursiva_, título, lista, lista numerada y lista de tareas. También puedes escribirlo: `**negrita**`, `_cursiva_`, `## título`, `- elemento`, `- [ ] tarea`. **Vista previa** muestra el texto con formato; **Editar** vuelve al texto. Se guarda solo.

Dentro de una **carpeta o proyecto**, la sección **Notas** guarda los textos de la carpeta (acuerdos, actas, ideas): todos en la carpeta los leen, y quien puede crear tareas allí escribe. No aparecen en tus notas personales.

### Comandos, destacados y más

Escribe **/** al comienzo de una línea para abrir los **comandos**: título, subtítulo, listas, tarea, destacado (nota, consejo, advertencia), tabla, enlace, resaltado, nota al pie, bloque de código y divisor. Sigue escribiendo para filtrar (`/tab` encuentra Tabla) y confirma con Enter o tocando.

- **Destacado** (callout): un cuadro de color. Escribe `> [!consejo] Título` y, en las líneas de abajo, `> el texto`. Tipos: nota, consejo, advertencia, peligro, pregunta, información, hecho y cita (los nombres en inglés de Obsidian también sirven). Con `-` después del tipo (`> [!advertencia]- Título`) empieza cerrado y se abre al tocar; con `+`, empieza abierto y se puede cerrar.
- **Resaltado**: `==texto==` queda marcado con fondo.
- **Nota al pie**: `[^1]` en el texto y, en cualquier línea, `[^1]: la explicación`. La llamada se vuelve un número pequeño y las notas aparecen al final.
- **Tabla**: líneas con `|` entre las columnas y `| --- | --- |` debajo del encabezado.

El **Índice** lista los títulos de la nota: en la computadora queda al lado del texto; en el celular, en el botón de índice de la barra. Toca un título para ir hasta él. Debajo del editor aparecen las **palabras** y los caracteres.

### Propiedades y etiquetas

Al editar, **Propiedad** (debajo del título) agrega un campo a la nota: autor, nota, leído, plazo… Cada uno tiene un tipo: texto, número, fecha, casilla, lista o enlace (`[[Nota]]`). Toca el nombre para cambiar el tipo o quitarlo. Dos tienen un sentido propio: **tags** (etiquetas) y **aliases** (otros nombres de la nota, que el `[[` y las menciones sin enlace también reconocen).

Para etiquetar, escribe `#etiqueta` en el texto o ponla en la propiedad tags. Usa la barra para anidar: `#entreno/pierna` queda dentro de `#entreno`. Tocar una etiqueta abre la pantalla **Etiquetas** (también en Más y en Ctrl+K), que junta las de las notas y las de las tareas; la etiqueta madre muestra también lo que está en las hijas.

### Nota del día y plantillas

**Nota del día** (el botón del cuaderno en Hoy, en Notas, en Ctrl+K o `Alt+D`; si el navegador usa `Alt+D`, `G D`) abre la nota de hoy, con el día en el título (`2026-11-03`), y la crea si todavía no existe. Debajo, al visualizarla, aparecen las tareas **completadas** y **creadas** ese día, como un diario automático. En el **Calendario**, los días con nota tienen un punto, y la lista del día tiene el botón para abrir (o escribir) la nota.

Una **plantilla** es una nota que sirve de punto de partida. En Notas → **Plantillas**, **Nueva plantilla**; o, en una nota, **Más opciones** → **Convertir en plantilla**. Las plantillas no aparecen en las listas. En el texto de la plantilla, `{{fecha}}`, `{{hora}}` y `{{titulo}}` se cambian por el día, la hora y el título al usarla. **Desde plantilla** (en Notas) crea una nota a partir de una de ellas, y **Usar en la nota del día** hace que cada nota del día nueva empiece con ella.

### Consultas

Una cerca ` ```questlist ` (o el comando `/consulta`) muestra, dentro de la nota, las tareas o notas que cumplen una pregunta escrita en palabras:

```
tareas donde etiqueta = casa y vencimiento <= hoy+7 ordenar por vencimiento
tareas de la lista "Mercado" no completadas
notas donde etiqueta = lectura y props.nota >= 4 como tabla
tareas de la carpeta "Trabajo" donde prioridad >= alta como conteo
```

Empieza con **tareas** o **notas**. Después, en cualquier orden: **de la lista "…"** o **de la carpeta "…"**; **donde** campo signo valor, unidos con **y** (campos: etiqueta, vencimiento, prioridad, título, estado, creada, actualizada y `props.nombre` para las propiedades; signos: `=`, `!=`, `<`, `<=`, `>`, `>=` y **contiene**; fechas: `hoy`, `hoy+7`, `ayer`, `mañana` o `2026-12-01`); **completadas** o **no completadas**; **ordenar por** campo (con **desc** para invertir); **límite** número; y **como lista**, **como tabla** o **como conteo**. Las palabras también valen en portugués e inglés. En la lista, las tareas tienen la casilla de verdad. La consulta se ejecuta en el dispositivo, también sin internet, y necesita un filtro (lista, carpeta, etiqueta o fecha) para no leerlo todo: sin él, avisa y no se ejecuta.

### Enlaces entre notas, tareas y listas

Escribe `[[` (o toca el botón de enlace de la barra) y empieza a escribir: aparecen tus notas (las más recientes primero), tareas, listas y proyectos. Elige uno y el enlace entra en el texto. En la vista previa aparece solo con el nombre, y tocarlo abre el elemento. Cambiar el nombre del elemento no rompe el enlace. También puedes ir a un título de la nota con `[[Nota#Título]]`.

La última opción crea un enlace a algo que **aún no existe** (`[[Nueva idea]]`). Aparece atenuado, y tocarlo crea la nota con ese nombre.

Debajo de la nota, **Citado en** muestra las notas y tareas que enlazan a ella, con la frase alrededor. **Enlaces salientes** lista lo que ella cita. **Menciones sin enlace** muestra tus notas que escriben su nombre sin `[[ ]]`, y **Enlazar** convierte la mención en enlace. La descripción de una tarea también acepta `[[`, y el panel de la tarea y la parte de arriba de una lista muestran **Citado en**. Funciona sin internet.

**Incrustar:** una línea solo con `![[...]]` (un `!` antes del enlace, o el comando `/incrustar`) muestra el elemento dentro de la nota: otra nota (entera, o solo una sección con `![[Nota#Título]]`), una lista con las casillas de verdad (completar ahí la completa en la lista), una tarea, o una imagen de los adjuntos de tus tareas por el nombre del archivo (`![[foto.jpg]]`). En la computadora, dejar el ratón sobre un enlace muestra una vista previa con las primeras líneas; en el móvil, mantén pulsado.

### Bases

Una lista de tipo **Base** muestra, en una sola pantalla, las tareas o notas que cumplen una consulta (el mismo lenguaje del bloque ` ```questlist ` de arriba), como **Tabla** o **Tarjetas**. Empieza con `tareas donde vence <= hoy+7 no completadas`; cambia el texto y toca **Aplicar** (o `Ctrl+Enter`). **Columnas** elige lo que aparece (en las notas, las propiedades también son columnas), **Agrupar** junta por estado, lista, etiqueta, prioridad o una propiedad, y tocar el nombre de la columna ordena (ascendente, descendente y de vuelta al orden de la consulta). En la tabla, toca una celda para editar: título, vencimiento (`2026-12-01`), prioridad (`0` a `3` o `!!`) y etiquetas en las tareas; título y propiedades en las notas (la casilla cambia con un toque). Las tareas tienen la casilla de verdad, y la flecha al final de la fila abre el elemento. La configuración queda guardada en la lista y vale para todo el proyecto; quien solo lee la ve, pero no la cambia.

### Grafo

**Grafo** (en Notas, en Más o en Ctrl+K) dibuja las notas, tareas, listas y carpetas como puntos y los enlaces `[[...]]` como líneas; cuanto más citado, más grande el punto, y el enlace a lo que todavía no existe aparece hueco. Filtra por tipo, etiqueta, carpeta o proyecto, y oculta las **Sueltas** (sin ningún enlace). **Buscar en el grafo** pone el foco en un elemento y muestra solo lo unido a él, a 1, 2 o 3 pasos. En el ordenador, la rueda del ratón acerca, arrastrar mueve la vista y los puntos, y hacer clic abre el elemento (el hueco crea la nota); en el móvil, desplázate y usa los botones de acercar. Debajo de cada nota, al visualizar, el **Grafo local** muestra los vecinos hasta 2 pasos, con **Abrir en el grafo**.

## Lista de compras del menú

En una lista de menú (de tipo Tareas o Rutina), cada plato es una tarea y los ingredientes son sus **subtareas** o las líneas con `-` en sus **notas** ("- 500 g de carne picada", "- 2 huevos"). En el menú de la lista, **Generar lista de compras** junta todo en una sola lista, sumando lo que se repite (500 g + 300 g de carne son 800 g; kg y litros también cuentan), y pregunta dónde ponerla: en una lista de la misma carpeta, en una lista nueva "Compras" o en la Bandeja de entrada. Antes de crear, la lista aparece en la creación en lote para que la revises. Los platos ya completados quedan fuera (si todos están completados, entran todos).
