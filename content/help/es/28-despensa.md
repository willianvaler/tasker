# Despensa y compras

La **Despensa** es un tipo de lista (**Nuevo** → Lista → **Despensa**) con los artículos de la casa: el **nombre**, **cuánto hay**, la **unidad**, el **mínimo** y cuánto **comprar cada vez**.

## De la despensa a la lista de compras

La primera vez, elige la **lista de compras**: **Crear la lista Compras** crea una lista común en la misma carpeta, o usa otra lista que ya exista allí. A partir de entonces:

- **Se acabó** pone el artículo en cero; **−** y **+** cambian de 1 en 1, y el lápiz edita los números.
- El artículo que **se acabó** o quedó **bajo el mínimo** entra solo en la lista de compras, como "Arroz (5 kg)" (el "comprar cada vez"). Entra **una sola vez**: bajarlo más o cambiar el mínimo no lo repite.
- **Marcar la compra como hecha** (en la lista de compras, en Hoy o en cualquier lugar) **suma al stock** el "comprar cada vez". Si sigue bajo el mínimo, el artículo vuelve a la lista. Deshacer la compra quita lo que se había sumado.
- Si el stock vuelve sobre el mínimo sin comprar (contaste de nuevo), el artículo sale de la lista de compras.
- Borrar el artículo quita la compra que seguía abierta.

Los artículos que faltan aparecen primero, con "En la lista de compras".

## Con la casa

En una carpeta de **proyecto**, la despensa y la lista de compras son de todos en el proyecto: quien puede crear tareas cambia los artículos, quien solo lee los ve. Quien gestiona el proyecto crea, borra o cambia la lista de compras.

Funciona sin internet: el cambio queda en el dispositivo y, al sincronizar, el servidor lo pone en la lista de compras. Así dos teléfonos que marcaron "se acabó" a la vez no crean la compra dos veces. No hay lectura de código de barras.
