# Repasar tarjetas (repetición espaciada)

Cualquier nota puede tener tarjetas de estudio. Escribe una línea con la **pregunta**, `?::` y la **respuesta**:

```
Capital de Francia ?:: París
- Orgánulo de la energía ?:: Mitocondria
```

Cada línea así se vuelve una tarjeta al guardar la nota. El comienzo de lista (`-`, `1.`) no entra en la pregunta, y lo que está dentro de un bloque de código no se vuelve tarjeta. Borrar la línea borra la tarjeta y sus repasos. Cambiar solo la **respuesta** (o el orden de las líneas) mantiene el historial; cambiar la **pregunta** empieza una tarjeta nueva.

## El repaso del día

En **Más → Repasar tarjetas** (o con Ctrl+K) está la sesión de hoy, con "Hoy: N tarjetas" arriba: primero las **vencidas**, de la más atrasada, después las **nuevas**, en el orden de las notas. En el **⋯** de una nota con tarjetas, **Repasar tarjetas** abre solo las suyas.

Piensa la respuesta, toca **Mostrar respuesta** y di cómo te fue. Cada botón muestra cuándo vuelve la tarjeta:

- **Fallé**: vuelve mañana y aparece otra vez al final de esta sesión.
- **Difícil**, **Bien** o **Fácil**: el intervalo crece (1 día, 6 días, después el intervalo anterior por la facilidad de la tarjeta). **Fácil** sube la facilidad; **Difícil** la baja.

La cuenta es la del **SM-2** (el algoritmo de SuperMemo, de dominio público), con un ajuste: fallar quita poco de la facilidad, para que la tarjeta difícil no se quede atascada.

## Límites del día

Por defecto, **20 tarjetas nuevas** y **200 repasos** por día. Cámbialos en **Límites del día** (el botón de arriba). Lo que pase del límite queda para mañana, y la pantalla dice cuántas.

## Sin internet y en dos dispositivos

El repaso funciona sin internet. Cada respuesta se guarda con la hora, y el estado de la tarjeta siempre se rehace en orden de hora: repasar en el móvil y en la computadora, incluso sin conexión, llega al mismo resultado cuando los dos sincronizan. Las tarjetas de una nota nueva o editada sin internet aparecen después de que se sincroniza.

En notas de un proyecto, quien es del proyecto ve las tarjetas, y cada persona tiene sus **propios** repasos. Repasar no da XP ni oro.
