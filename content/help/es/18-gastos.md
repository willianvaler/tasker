# Gastos y foto del ticket

Una lista de tipo **Gastos** (Nuevo → Lista → Gastos) es una hoja de registros: lo que salió y lo que entró, con fecha, categoría, forma de pago y quién pagó. Sirve para una reforma, un viaje, un evento o la casa. Funciona sin internet, como las tareas.

## Registrar

- En el cuadro de arriba, escribe la **descripción** y el **importe** (`12,50`, `1.234,56`) y toca **Registrar** (o Enter). Elige **Gasto** o **Ingreso** y, si quieres, una categoría.
- Toca una fila para abrir el registro completo: fecha (`12/10`, `ayer`), categoría, forma de pago, quién pagó (en un proyecto), observación. Al cerrar se guarda. **Borrar registro** lo manda a la papelera.
- Arriba: **Gastado**, **Ingresos** y **Saldo** del periodo (**Este mes** o **Todo**), el **presupuesto** con la barra de cuánto se usó, y el gasto **por categoría**.
- Las pestañas **General**, **Gastos** e **Ingresos** dividen la lista: en **Gastos** quedan solo las salidas (con el presupuesto, las categorías y la división de cuentas) y en **Ingresos**, solo las entradas. El registro rápido, la lista y **Exportar** siguen la pestaña. El dispositivo recuerda la pestaña de cada lista.
- En un proyecto, el Lector ve; el Colaborador registra y cambia solo lo suyo; Editor, Gerente y Dueño cambian todo.

## Foto del ticket

**Foto del ticket** saca una foto (o elige varias de la galería) y lee el comercio, la fecha, el total, la forma de pago y los artículos. Revisas todo antes de guardar: nada entra solo. Con **Un registro por artículo**, cada artículo del ticket es una fila. La foto queda guardada en el registro. Un ticket electrónico brasileño (NFC-e) con clave de acceso no entra dos veces: la app avisa si ya está.

La lectura necesita internet y se hace en el propio servidor de Questlist, con un programa de reconocimiento de texto (Tesseract): la foto del ticket no va a ninguna otra empresa. Funciona mejor con el ticket entero en la foto, derecho, bien iluminado y sin pliegues; revisa sobre todo el total y la fecha. Mientras la app está en prueba no hay límite de fotos por cuenta.

## Foto de una lista

Al crear varias tareas (**Varias** en una lista), **Foto de una lista** lee una lista en papel (compras, tareas, entrenamiento) y pone cada línea en el texto, con la sintaxis rápida de siempre (`3x12 40kg`, `mañana`). Revisa la vista previa y crea. Como la lista suele estar escrita a mano, esa foto la lee Google (Gemini), que recibe solo la foto.

## Exportar

**Exportar** descarga lo que está en pantalla (el periodo elegido) como **CSV** (se abre en Excel y Google Sheets) o **XLSX** (Excel, con importes en moneda, fechas y una hoja de resumen por categoría y por mes). En el móvil, abre Compartir.

## Dividir la cuenta

En un proyecto con más de una persona, cada gasto nace **dividido entre todos** los miembros, en partes iguales. En el registro, **Dividido entre** quita o agrega personas (sin nadie marcado, el gasto no entra en la cuenta dividida); para que cuente, marca también **Quién pagó**. La sección **Dividir la cuenta** muestra cuánto tiene a favor o debe cada uno, sumando todos los meses, y la forma más corta de saldar ("Bia paga 150,00 € a Ana"). **Registrar pago** registra ese pago: aparece en la lista con ⇄, no cuenta como gasto ni como ingreso y salda la deuda. Pago equivocado: bórralo y regístralo de nuevo.
