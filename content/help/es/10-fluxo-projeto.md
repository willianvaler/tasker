# Entender el proyecto

El proyecto tiene cinco pestañas:

- **Lista** — las listas, el progreso, los hitos, el jefe del proyecto y "cómo va el flujo": lo que más frena el proyecto, el camino crítico y quién tiene tareas atrasadas.
- **Flujo** — el mapa de dependencias, de izquierda a derecha. **Estás aquí** marca lo que ya se puede hacer; "Tu turno" son las tuyas. También como lista, si lo prefieres.
- **Gantt** — una barra por tarea con fecha, del **inicio** al **vencimiento**, con las flechas de las dependencias y la línea de hoy. Arrastra la barra para cambiar las dos fechas, o un borde para cambiar solo el inicio o el fin; al tocar la barra, un menú hace lo mismo día a día (útil en el móvil, donde hay que mantener pulsado antes de arrastrar). Borde naranja: la tarea empieza antes de que termine un prerrequisito. Abajo quedan las tareas sin fecha: un toque las pone para hoy. El inicio también se cambia en el panel de la tarea, en **Empieza el**. **Guardar línea base** guarda las fechas actuales (hasta 5 por proyecto, para quien maneja la estructura); al tocar una línea base, cada tarea muestra debajo la barra fina del plan y el atraso en días ("+3 d"), y el resumen dice cuántas se atrasaron, cuántas entraron y cuántas salieron desde entonces. Los indicadores comparan con la más nueva.
- **Personas** — cada persona con lo que está **haciendo**, lo que está **listo**, lo que está **esperando** y lo que terminó.
- **Línea de tiempo** — quién hizo qué y cuándo, con filtros y exportación CSV.

Cada tarea también tiene su **Historial**, en el panel.

## Hitos y roadmap

Los **hitos** del proyecto (en la vista general, "Nuevo hito") tienen un **Roadmap**: los hitos por fecha, cada uno con sus tareas vinculadas, la barra de progreso, cuántas están atrasadas y cuántas bloqueadas. Un hito con la fecha ya pasada y tareas abiertas queda con el borde rojo; abajo aparece cuántas tareas abiertas no tienen hito.

Para vincular una tarea a un hito, elígelo en el **panel de la tarea** (sección Hito) o escribe `~nombre` al crear, como `Comprar el piso ~Entrega` (vale en la escritura rápida y en Añadir varias; el nombre se compara sin tildes, espacios ni puntuación). Un hito desconocido no se vincula y avisa.

En el **Gantt**, cada hito es un rombo en su fecha, arriba de la cuadrícula; al tocarlo se abre el menú para mover la fecha día a día o abrir el Roadmap. Al **terminar el hito** en el Roadmap, **Notas de la versión** crea una nota en el proyecto con lo que se hizo y lo que quedó para después, lista para copiar o publicar.
