# Tareas que dependen de otras

En el asado, **encender el fuego** depende de **comprar carbón**. Únelas: en el panel del fuego, en **Depende de**, elige "Comprar carbón" (o escribe `^carbón` al crear).

Mientras no se compre el carbón, el fuego queda **bloqueado** (candado) y muestra "Esperando: Comprar carbón". Cuando alguien lo compre, el fuego queda **listo** y quien se encarga recibe un aviso.

## Escribiendo con ^

Al crear la tarea, `^` seguido de una parte del nombre une la nueva tarea a una que ya existe: `Encender el fuego ^carbón`. Mientras escribes aparecen las tareas que coinciden; Enter elige. En el lote, `^2` apunta al elemento 2 de la misma lista. Vale en proyectos y en tus carpetas, entre tareas de la misma carpeta (y sus subcarpetas).

**Depende de** siempre está a la vista en el panel de la tarea, en la sección **Vínculos** (arriba en un proyecto, después de las subtareas en una carpeta personal), junto a **Relacionados**: "depende de" espera a que la otra termine; "relacionado" es solo un atajo entre las dos. La pestaña **Flujo** de la carpeta muestra quién espera a quién.

## Tarea de otro proyecto

En **Depende de**, la búsqueda también muestra las tareas de tus **otros proyectos y carpetas**, con el nombre del proyecto al lado. Ejemplo: en Reforma, "Colocar el piso" espera "Comprar piso" del proyecto Mercado. Para enlazarlas tienes que poder editar en los dos (quien solo lee el otro proyecto no enlaza). Quien es solo de Reforma ve el título y si la compra ya se hizo, nunca el resto de Mercado; del lado de Mercado, "Comprar piso" muestra en **Libera** la tarea que la espera. El **^** de la escritura rápida sigue solo en el mismo proyecto.

## Estricto o flexible

En el proyecto, el modo **estricto** no deja empezar lo bloqueado. El **flexible** deja forzarlo y registra quién lo hizo.

## Lista que espera a otra

Una lista entera puede esperar a que otra llegue al 50%, 75% o 100% (Configurar lista → Se libera después de).

## Atajos

`L` une la tarea seleccionada a otra. `S` la inicia.
