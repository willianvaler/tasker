# Carpetas, proyectos y listas

- Una **lista** guarda tus cosas: compras, entrenamiento, plan de viaje. El tipo puede ser **Tareas**, **Rutina** (checklist en tarjetas que se reinicia; buena para entrenar), **Hábitos**, **Tablero** o **Gastos**. Toda lista de tareas también se abre como **Tablero** (pestaña arriba). En el tablero, arrastra la tarjeta a otra columna (en el móvil, mantenla pulsada antes de arrastrar) o usa las flechas de la tarjeta. Para abrir la tarea, toca el lápiz de la tarjeta.
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

### Enlaces entre notas, tareas y listas

Escribe `[[` (o toca el botón de enlace de la barra) y empieza a escribir: aparecen tus notas (las más recientes primero), tareas, listas y proyectos. Elige uno y el enlace entra en el texto. En la vista previa aparece solo con el nombre, y tocarlo abre el elemento. Cambiar el nombre del elemento no rompe el enlace. También puedes ir a un título de la nota con `[[Nota#Título]]`.

La última opción crea un enlace a algo que **aún no existe** (`[[Nueva idea]]`). Aparece atenuado, y tocarlo crea la nota con ese nombre.

Debajo de la nota, **Citado en** muestra las notas y tareas que enlazan a ella, con la frase alrededor. **Enlaces salientes** lista lo que ella cita. **Menciones sin enlace** muestra tus notas que escriben su nombre sin `[[ ]]`, y **Enlazar** convierte la mención en enlace. La descripción de una tarea también acepta `[[`, y el panel de la tarea y la parte de arriba de una lista muestran **Citado en**. Funciona sin internet.

## Lista de compras del menú

En una lista de menú (de tipo Tareas o Rutina), cada plato es una tarea y los ingredientes son sus **subtareas** o las líneas con `-` en sus **notas** ("- 500 g de carne picada", "- 2 huevos"). En el menú de la lista, **Generar lista de compras** junta todo en una sola lista, sumando lo que se repite (500 g + 300 g de carne son 800 g; kg y litros también cuentan), y pregunta dónde ponerla: en una lista de la misma carpeta, en una lista nueva "Compras" o en la Bandeja de entrada. Antes de crear, la lista aparece en la creación en lote para que la revises. Los platos ya completados quedan fuera (si todos están completados, entran todos).
