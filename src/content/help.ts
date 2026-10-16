// GERADO por scripts/help-build.mjs a partir de content/help/. Não edite à mão: npm run help:build

export type HelpArticle = { slug: string; title: string; body: string };

export const HELP: Record<string, HelpArticle[]> = {
  "en": [
    {
      "slug": "comecando",
      "title": "Getting started in 1 minute",
      "body": "Type in the **New task** field and press Enter. Done: the task goes to the Inbox (or to the open page).\n\n## Quick syntax\n\nThe text itself fills in the details:\n\n- `tomorrow`, `friday`, `10/15` — due date\n- `!`, `!!`, `!!!` — priority\n- `#groceries` — label\n- `/daily`, `/weekly`, `/mon,wed` — repeat\n- `3x12` — 3 sets of 12; `x8` — do it 8 times\n- `@ana` — assignee (in a project)\n\nExample: `Pay the power bill friday !! #home` becomes \"Pay the power bill\", due Friday, medium priority, label home.\n\n## Many at once\n\nPaste a list (one per line) or tap **Many**. Indented lines become subtasks. You see a preview before creating.\n\n## Checking off\n\nTap the box. Mistake? The notice has **Undo**."
    },
    {
      "slug": "pastas-projetos-paginas",
      "title": "Folders, projects and pages",
      "body": "- A **page** is a list of things: groceries, a workout, a trip plan. It can be a **list**, **cards** (good for workouts), **kanban** or **habits**.\n- A **folder** groups your pages. Example: the **Gym** folder with Workout A and Workout B.\n- A **project** is a folder to do **with other people**. Example: the **Barbecue** project with Shopping and On the day lists, each friend with their own tasks.\n\n## When to use which\n\n- Just you, something recurring: **folder**.\n- More people, something with a start and an end: **project**.\n- A workout for a student, a meal plan for a patient: **send the page** (see \"Sending a page\").\n\n## Reset\n\nA page can **reset** its checks every day, every week or when you say so. Great for weekly workouts and routines.\n\n## Moving\n\nIn the page menu, **Move to…** takes the page (with its tasks) to another folder or project."
    },
    {
      "slug": "criar-rapido-avancado",
      "title": "Quick or detailed creation",
      "body": "**Quick:** the New task field. Type and press Enter. It covers almost everything.\n\n**Detailed:** the button next to the field, the **New** menu or `Alt+Shift+N`. It opens a panel with page, description, due date, priority, repeat, sets and labels. `Ctrl+Enter` creates.\n\n## Editing later\n\nTap the task's arrow (or `Enter` with it selected) to open the **panel**: description (up to 10,000 characters; when empty, \"+ Add description\" shows), date, priority, weight, time, subtasks, assignees, dependencies, page fields and comments. Each field saves when you leave it.\n\nAt the top of the panel, **Simple ▾** shows only the essentials; switch to **Full** to see time, sets, weight, dependencies, fields, approval, My day and history. Whatever the task already uses shows even in Simple.\n\n## The New menu\n\n`Alt+N` (or the **New** button) and a letter: **T** task, **P** page, **F** folder, **J** project, **H** habit.\n\n## Attachments\n\nIn the panel, **Attach** adds a photo (from the gallery or, on the phone, the camera) or a file to the task. Photos are shrunk on the device before uploading (to fit a 2048 px square), so they take little space; the list shows only the thumbnail and the full photo downloads when you open it. Each file can be up to **10 MB**, and each account has **1 GB** (see your usage in Profile). Whoever sees the task sees its attachments; whoever can edit it attaches and removes. Offline, the attachment waits on the device and uploads by itself later."
    },
    {
      "slug": "editar-f2",
      "title": "Quick edit with F2",
      "body": "Select a task (click it or use `J` and `K`) and press **F2**: the title becomes a field. Enter saves, Esc cancels.\n\nWith no task selected, **F2** renames the open page or folder, and you can change its **icon** right there.\n\n## Other list shortcuts\n\n- `Space` or `X` — complete\n- `1`, `2`, `3` — priority\n- `D` — date · `Z` — snooze to tomorrow\n- `M` — add to My day\n- `S` — start · `P` — pomodoro · `Shift+T` — stopwatch\n- `Delete` — delete (with Undo)\n\nThe full list is under **Shortcuts** below, or press `?`."
    },
    {
      "slug": "time",
      "title": "Working with other people",
      "body": "In a project, open **People** and tap **Create invite link**. Send the link: whoever opens it creates an account right there and joins.\n\nBefore inviting, you can write `@gregory` in tasks. When Gregory joins, he says \"I'm @gregory\" and those tasks become his.\n\n## Roles\n\n- **Owner** — everything, including deleting the project\n- **Manager** — everything but deleting the project\n- **Editor** — works on everything, doesn't manage people\n- **Contributor** — creates and does their own tasks\n- **Viewer** — only sees and comments\n\nTeams can have **custom roles**, picking permission by permission.\n\n## I'll take it\n\nOn a task with nobody assigned, **I'll take it** makes you the assignee. Great for splitting the barbecue."
    },
    {
      "slug": "sem-internet",
      "title": "Works offline",
      "body": "After the first sync, the app keeps your data **on the device**. With no signal you keep creating, checking, editing and working out. When the connection returns, everything goes up on its own, in the order you did it.\n\n## The sync dot\n\n- **Green** — all caught up\n- **Yellow** — sending or receiving\n- **Red** — offline (what you do is kept) or something was refused; open it to see which\n\nTap it (or Profile → Sync) to see the queue and force a send.\n\n## Conflicts\n\nIf you and someone else change the same task offline, the last change **for each field** wins. For the description, the losing version is kept: \"See previous version\" shows up.\n\n## What needs a connection\n\nInvites, the students panel, automations, reports and the shop."
    },
    {
      "slug": "gamificacao",
      "title": "XP, streaks and bosses",
      "body": "Completing gives **XP**. XP raises your **level**. Doing something every day keeps your **streak**.\n\nEvery day a **daily boss** is born (about 6 tasks) and every week a **weekly boss** (about 5 days of use). Each task or habit is a hit that counts for both at once (and for the clan's). The daily one gives a smaller reward and has its own streak; the weekly one gives XP, gold and an item. The completion notice shows how much each has left.\n\n## Fair, no tricks\n\n- Creating and completing right away gives no XP (the hit still counts).\n- Unchecking takes back what you earned.\n- A parent task with subtasks gives no XP: the subtasks do.\n- Pomodoro gives a small bonus, up to 4 a day.\n- Each \"good and bad\" habit counts up to 10 \"+\" a day, and tasks created and completed within a few minutes have a daily cap. When a limit is reached, the notice says so.\n\n## Character\n\nPick a **class**, spend **attributes** and use one skill a day. Gold buys items in the **shop** (cosmetic only).\n\n## Turning it off\n\nProfile → **Gamification**. The app becomes just a task list."
    },
    {
      "slug": "subtarefas",
      "title": "Subtasks and levels",
      "body": "A task can have **subtasks**, and so can they. The default limit is **4 levels** (change it per page or project).\n\n## Creating\n\n- In the task panel, under **Subtasks**.\n- In the list, `Tab` indents (makes it a child of the one above) and `Shift+Tab` brings it back.\n- In bulk, indent with two spaces per level.\n\n## How it counts\n\nThe parent is a **bundle**: its progress is its subtasks' (\"2/5\"), and it completes itself when the last one closes. Each subtask's weight (1 to 5) changes how much it counts.\n\n## Codes\n\nPress `W` to see codes like **1.2.3**. The **Structure** view shows the whole tree, and the page menu exports it as text."
    },
    {
      "slug": "dependencias",
      "title": "Tasks that depend on others",
      "body": "At the barbecue, **light the fire** depends on **buy charcoal**. Link them: in the fire's panel, under **Depends on**, pick \"Buy charcoal\" (or type `^charcoal` when creating).\n\nUntil the charcoal is bought, the fire is **blocked** (padlock) and shows \"Waiting for: Buy charcoal\". When someone buys it, the fire becomes **ready** and whoever owns it gets a notice.\n\n## Strict or flexible\n\nIn the project, **strict** mode doesn't let you start what's blocked. **Flexible** lets you force it, and records who did.\n\n## A list waiting for a list\n\nA whole list can wait for another to reach 50%, 75% or 100% (Page settings → Unlocks after).\n\n## Shortcuts\n\n`L` links the selected task to another. `S` starts it."
    },
    {
      "slug": "fluxo-projeto",
      "title": "Understanding the project",
      "body": "A project has four tabs:\n\n- **List** — the lists, progress, milestones, the project boss and \"how the flow is going\": what's holding the project back, the critical path and who has overdue tasks.\n- **Flow** — the dependency map, left to right. **You are here** marks what can be done now; \"Your turn\" are yours. Also as a list, if you prefer.\n- **People** — each person with what they're **doing**, what's **ready**, what's **waiting** and what they finished.\n- **Timeline** — who did what and when, with filters and CSV export.\n\nEach task also has its own **History**, in the panel."
    },
    {
      "slug": "repeticoes-descanso",
      "title": "Sets, reps and rest",
      "body": "Type `Bench press 4x12` and the task asks for **4 sets**. The row shows **0/4**: each tap counts a set, and the last one completes it (that's when XP comes). `x8` makes a counter: drink water 8 times.\n\n## Rest\n\nAfter each set a **rest** starts (60 s by default; change it under \"How many times\" in the panel). The countdown shows at the bottom, with **−30**, **+30** and **Skip**. On the phone you're notified even with the screen locked. In the browser, the notice comes if the tab is open, even hidden.\n\n## Workout mode\n\nOn card pages or pages with tasks that have sets, **Start workout** opens full screen: current exercise, set, load, a big **Done** button (or `Space`), `R` skips the rest. After the last exercise, the workout closes by itself and a short notice shows sets, time, volume and XP. Works offline and keeps the screen on.\n\n**Without unlocking the phone (Android):** with Workout Mode open, the set shows on the lock screen with **Done**, **Skip rest** and **+30 s**. Tap the notification's arrow to see the buttons. While the phone is locked, what you mark stays on the device and syncs when you open the app again.\n\n## Mode: workout, focus or rest\n\nThe **Mode** button (sidebar; on the phone, **⚡ Mode** at the top of Today and Home; or `Ctrl+K`) gathers the three: **Workout** opens Workout Mode for a cards page or one with sets; **Focus** starts a pomodoro; **Rest** starts a 30 s to 5 min timer that alerts at the end with sound, vibration and a notification."
    },
    {
      "slug": "pomodoro",
      "title": "Pomodoro and time",
      "body": "**Pomodoro:** 25 minutes of focus, a 5-minute break, and a long break every 4 focus rounds. Start it in the task panel, with `P` on the selected task or from the palette (`Ctrl+K`).\n\nWhen focus ends you get a break idea: grab a coffee, get some air, stretch. Change the ideas, their order and the durations in **Profile → Pomodoro**.\n\n## Logging time\n\n- The task **stopwatch**: in the panel or `Shift+T`.\n- **Log by hand**: type `45m`, `1h30 yesterday` or `30 10/14`.\n- Each finished pomodoro counts too.\n\nThe panel shows \"Done: 1h20 of 2h\" (against the estimate) and the parent adds up its subtasks. In **Profile → Pomodoro** you see today, the week and where the time went; in the project, time per list and per person."
    },
    {
      "slug": "enviar-pagina",
      "title": "Sending a page (a workout for a student)",
      "body": "Build the page (a workout, a meal plan, homework) and, in its menu, tap **Send to…**.\n\n- **Live** — you keep adjusting; the recipient sees the changes and tracks their own progress. Each student only sees their own.\n- **Copy** — the person gets a copy that becomes theirs.\n\nSend it by **link** (WhatsApp, for example) or **email**. People without an account create one right there and land on the page.\n\n## The recipient\n\nThe page shows up under **Received**. They can check things off, log sets and load, leave a **note** (\"my shoulder hurt\") and use Workout mode, offline too.\n\n## Students panel\n\nOn a sent page, the **Students** button shows each one: how much they did this week, adherence over the last 4 weeks, how their loads evolved and their notes. You can **remind** whoever went quiet and **archive** whoever stopped."
    },
    {
      "slug": "organizar-o-dia",
      "title": "Planning the day and automating",
      "body": "- **My day** — pick what you'll do today (`M` or in the panel), put it in order and say how much time you have: the app shows whether it fits.\n- **Do now** — the suggestion of what to do next: what's already started, your day, what's overdue.\n- **Snooze** — the alarm clock on the row (or `Z`) moves it to tomorrow.\n- **Fields** — in the page menu, create fields like Cost, Stage or Buyer.\n- **Approval** — a task only one person (or a manager) can complete: the owner approves the budget before buying.\n\n## Automations\n\nIn a project, **Automations** creates \"when… then…\" rules. Example: when a task in the On the day list is completed, create \"Clean the grill\" in the After list. Up to 20 per project; if an action can't run, it shows in the recent runs and nothing is lost."
    },
    {
      "slug": "perguntas",
      "title": "Frequently asked questions",
      "body": "**I deleted something by mistake.** Use Undo on the notice. After that, Profile → **Trash** keeps it for 30 days.\n\n**My task disappeared from Today.** It was completed, snoozed or its date changed. Find it with `Ctrl+K`.\n\n**Why didn't I get XP?** Completed right after creating, unchecked, or it's a parent task. See \"XP, streaks and bosses\".\n\n**The rest alert didn't ring on my computer.** The browser only alerts with the tab open (it can be hidden) and notification permission granted.\n\n**How do I export my data?** Profile → Privacy → Export (JSON or CSV).\n\n**How do I leave a project?** In the project, **People** → **Leave project**.\n\n**Can I use it without the game part?** Yes: Profile → Gamification.\n\n**Where do I change the language?** Profile → Language.\n\n**The timer alert doesn't vibrate / doesn't show.** Profile → Alerts → **Timer alerts**: check that notifications are allowed and use **Test alert**. iPhone in the browser and computers don't vibrate.\n\n**Is there a phone app?** For Android, yes: Profile → **Android app** → Download the app (APK). Open the file and allow installing from this source. To update, download again and install over it. Not for iPhone yet."
    }
  ],
  "es": [
    {
      "slug": "comecando",
      "title": "Empezar en 1 minuto",
      "body": "Escribe en el campo **Nueva tarea** y pulsa Enter. Listo: la tarea va a la Bandeja de entrada (o a la página abierta).\n\n## Escritura rápida\n\nEl propio texto completa los detalles:\n\n- `mañana`, `viernes`, `15/10` — vencimiento\n- `!`, `!!`, `!!!` — prioridad\n- `#mercado` — etiqueta\n- `/diaria`, `/semanal`, `/lun,mie` — repetir\n- `3x12` — 3 series de 12; `x8` — hacerlo 8 veces\n- `@ana` — responsable (en un proyecto)\n\nEjemplo: `Pagar la luz viernes !! #casa` queda \"Pagar la luz\", vence el viernes, prioridad media, etiqueta casa.\n\n## Varias a la vez\n\nPega una lista (una por línea) o toca **Varias**. Las líneas con sangría son subtareas. Antes de crear ves cómo quedará.\n\n## Marcar\n\nToca la casilla. ¿Te equivocaste? El aviso tiene **Deshacer**."
    },
    {
      "slug": "pastas-projetos-paginas",
      "title": "Carpetas, proyectos y páginas",
      "body": "- Una **página** es una lista de cosas: compras, entrenamiento, plan de viaje. Puede ser **lista**, **tarjetas** (buena para entrenar), **kanban** o **hábitos**.\n- Una **carpeta** agrupa tus páginas. Ejemplo: la carpeta **Gimnasio** con Entrenamiento A y B.\n- Un **proyecto** es una carpeta para hacer **con otras personas**. Ejemplo: el proyecto **Asado** con las listas Compras y Día, cada amigo con sus tareas.\n\n## Cuándo usar cada uno\n\n- Solo tú, algo que se repite: **carpeta**.\n- Más gente, algo con inicio y fin: **proyecto**.\n- Un entrenamiento para un alumno, un menú para un paciente: **envía la página** (ver \"Enviar una página\").\n\n## Reinicio\n\nUna página puede **reiniciar** sus marcas cada día, cada semana o cuando digas. Ideal para entrenamientos semanales y rutinas.\n\n## Mover\n\nEn el menú de la página, **Mover a…** lleva la página (con sus tareas) a otra carpeta o proyecto."
    },
    {
      "slug": "criar-rapido-avancado",
      "title": "Crear rápido o con detalles",
      "body": "**Rápido:** el campo Nueva tarea. Escribe y pulsa Enter. Sirve para casi todo.\n\n**Con detalles:** el botón junto al campo, el menú **Nuevo** o `Alt+Shift+N`. Abre un panel con página, descripción, vencimiento, prioridad, repetición, series y etiquetas. `Ctrl+Enter` crea.\n\n## Editar después\n\nToca la flecha de la tarea (o `Enter` con ella seleccionada) para abrir el **panel**: descripción (hasta 10.000 caracteres; vacía, aparece \"+ Añadir descripción\"), fecha, prioridad, peso, tiempo, subtareas, responsables, dependencias, campos de la página y comentarios. Cada campo se guarda al salir de él.\n\nArriba del panel, **Simple ▾** muestra solo lo esencial; cambia a **Completo** para ver tiempo, series, peso, dependencias, campos, aprobación, Mi día e historial. Lo que la tarea ya usa aparece incluso en Simple.\n\n## El menú Nuevo\n\n`Alt+N` (o el botón **Nuevo**) y una letra: **T** tarea, **P** página, **F** carpeta, **J** proyecto, **H** hábito.\n\n## Adjuntos\n\nEn el panel, **Adjuntar** añade una foto (de la galería o, en el móvil, de la cámara) o un archivo a la tarea. Las fotos se reducen en el dispositivo antes de subirlas (caben en un cuadrado de 2048 px), así que ocupan poco; la lista muestra solo la miniatura y la foto grande se descarga al abrirla. Cada archivo puede tener hasta **10 MB**, y cada cuenta tiene **1 GB** (mira cuánto usas en el Perfil). Quien ve la tarea ve los adjuntos; quien puede editarla adjunta y quita. Sin internet, el adjunto espera en el dispositivo y se sube solo después."
    },
    {
      "slug": "editar-f2",
      "title": "Editar rápido con F2",
      "body": "Selecciona una tarea (haz clic o usa `J` y `K`) y pulsa **F2**: el título se vuelve un campo. Enter guarda, Esc cancela.\n\nSin tarea seleccionada, **F2** renombra la página o carpeta abierta, y ahí mismo puedes cambiar el **ícono**.\n\n## Otros atajos de la lista\n\n- `Espacio` o `X` — completar\n- `1`, `2`, `3` — prioridad\n- `D` — fecha · `Z` — posponer para mañana\n- `M` — poner en Mi día\n- `S` — iniciar · `P` — pomodoro · `Shift+T` — cronómetro\n- `Supr` — borrar (con Deshacer)\n\nLa lista completa está en **Atajos**, más abajo, o pulsa `?`."
    },
    {
      "slug": "time",
      "title": "Trabajar con otras personas",
      "body": "En un proyecto, abre **Personas** y toca **Generar enlace de invitación**. Envía el enlace: quien lo abra crea la cuenta ahí mismo y entra.\n\nAntes de invitar, puedes escribir `@gregorio` en las tareas. Cuando Gregorio entre, dice \"soy @gregorio\" y esas tareas pasan a ser suyas.\n\n## Cargos\n\n- **Dueño** — todo, incluso borrar el proyecto\n- **Gerente** — todo menos borrar el proyecto\n- **Editor** — trabaja en todo, no gestiona personas\n- **Colaborador** — crea y hace sus tareas\n- **Lector** — solo ve y comenta\n\nLos equipos pueden tener **cargos personalizados**, eligiendo permiso por permiso.\n\n## Yo lo llevo\n\nEn una tarea sin nadie, **Yo lo llevo** te pone como responsable. Ideal para repartir el asado."
    },
    {
      "slug": "sem-internet",
      "title": "Funciona sin internet",
      "body": "Tras la primera sincronización, la app guarda tus datos **en el dispositivo**. Sin señal sigues creando, marcando, editando y entrenando. Cuando vuelve la conexión, todo sube solo, en el orden en que lo hiciste.\n\n## El punto de sincronización\n\n- **Verde** — todo al día\n- **Amarillo** — enviando o recibiendo\n- **Rojo** — sin conexión (lo que hagas queda guardado) o algo fue rechazado; ábrelo para ver cuál\n\nTócalo (o Perfil → Sincronización) para ver la cola y forzar el envío.\n\n## Conflictos\n\nSi tú y otra persona cambian la misma tarea sin internet, gana el último cambio **de cada campo**. En la descripción, la versión que perdió queda guardada: aparece \"Ver versión anterior\".\n\n## Lo que necesita conexión\n\nInvitaciones, el panel de alumnos, automatizaciones, informes y la tienda."
    },
    {
      "slug": "gamificacao",
      "title": "XP, racha y jefes",
      "body": "Completar da **XP**. La XP sube el **nivel**. Hacer algo cada día mantiene la **racha**.\n\nCada día nace un **jefe del día** (unas 6 tareas) y cada semana un **jefe de la semana** (unos 5 días de uso). Cada tarea o hábito es un golpe que cuenta para los dos a la vez (y para el del clan). El del día da una recompensa menor y tiene su propia racha; el de la semana da XP, oro y un objeto. El aviso al completar muestra cuánto le queda a cada uno.\n\n## Justo, sin trucos\n\n- Crear y completar al instante no da XP (el golpe sí cuenta).\n- Desmarcar devuelve lo ganado.\n- Una tarea madre con subtareas no da XP: lo dan las subtareas.\n- El pomodoro da un bono pequeño, hasta 4 al día.\n- Cada hábito \"bueno y malo\" vale hasta 10 \"+\" al día, y las tareas creadas y completadas en pocos minutos tienen un tope diario. Cuando se llega a un límite, el aviso lo dice.\n\n## Personaje\n\nElige una **clase**, reparte **atributos** y usa una habilidad al día. El oro compra objetos en la **tienda** (solo estéticos).\n\n## Apagar\n\nPerfil → **Gamificación**. La app queda solo como lista de tareas."
    },
    {
      "slug": "subtarefas",
      "title": "Subtareas y niveles",
      "body": "Una tarea puede tener **subtareas**, y ellas también. El límite por defecto es **4 niveles** (se cambia por página o proyecto).\n\n## Crear\n\n- En el panel de la tarea, en **Subtareas**.\n- En la lista, `Tab` sangra (la vuelve hija de la de arriba) y `Shift+Tab` la devuelve.\n- En lote, sangra con dos espacios por nivel.\n\n## Cómo cuenta\n\nLa madre es un **paquete**: su progreso es el de las subtareas (\"2/5\"), y se completa sola cuando cierra la última. El peso de cada subtarea (1 a 5) cambia cuánto cuenta.\n\n## Códigos\n\nPulsa `W` para ver códigos como **1.2.3**. La vista **Estructura** muestra el árbol entero y el menú de la página lo exporta como texto."
    },
    {
      "slug": "dependencias",
      "title": "Tareas que dependen de otras",
      "body": "En el asado, **encender el fuego** depende de **comprar carbón**. Únelas: en el panel del fuego, en **Depende de**, elige \"Comprar carbón\" (o escribe `^carbón` al crear).\n\nMientras no se compre el carbón, el fuego queda **bloqueado** (candado) y muestra \"Esperando: Comprar carbón\". Cuando alguien lo compre, el fuego queda **listo** y quien se encarga recibe un aviso.\n\n## Estricto o flexible\n\nEn el proyecto, el modo **estricto** no deja empezar lo bloqueado. El **flexible** deja forzarlo y registra quién lo hizo.\n\n## Lista que espera a otra\n\nUna lista entera puede esperar a que otra llegue al 50%, 75% o 100% (Configurar página → Se libera después de).\n\n## Atajos\n\n`L` une la tarea seleccionada a otra. `S` la inicia."
    },
    {
      "slug": "fluxo-projeto",
      "title": "Entender el proyecto",
      "body": "El proyecto tiene cuatro pestañas:\n\n- **Lista** — las listas, el progreso, los hitos, el jefe del proyecto y \"cómo va el flujo\": lo que más frena el proyecto, el camino crítico y quién tiene tareas atrasadas.\n- **Flujo** — el mapa de dependencias, de izquierda a derecha. **Estás aquí** marca lo que ya se puede hacer; \"Tu turno\" son las tuyas. También como lista, si lo prefieres.\n- **Personas** — cada persona con lo que está **haciendo**, lo que está **listo**, lo que está **esperando** y lo que terminó.\n- **Línea de tiempo** — quién hizo qué y cuándo, con filtros y exportación CSV.\n\nCada tarea también tiene su **Historial**, en el panel."
    },
    {
      "slug": "repeticoes-descanso",
      "title": "Series, repeticiones y descanso",
      "body": "Escribe `Press banca 4x12` y la tarea pide **4 series**. En la fila aparece **0/4**: cada toque cuenta una serie, y la última la completa (ahí llega la XP). `x8` crea un contador: beber agua 8 veces.\n\n## Descanso\n\nTras cada serie empieza el **descanso** (60 s por defecto; cámbialo en \"Cuántas veces\", en el panel). La cuenta aparece abajo, con **−30**, **+30** y **Saltar**. En el teléfono te avisa incluso con la pantalla bloqueada. En el navegador, el aviso llega si la pestaña está abierta, aunque esté oculta.\n\n## Modo Entrenamiento\n\nEn páginas de tarjetas o con tareas que tienen series, **Empezar entrenamiento** abre la pantalla completa: ejercicio actual, serie, carga, un botón grande **Hecha** (o `Espacio`), `R` salta el descanso. Al terminar el último ejercicio, el entrenamiento se cierra solo y un aviso corto muestra series, tiempo, volumen y XP. Funciona sin internet y mantiene la pantalla encendida.\n\n**Sin desbloquear el móvil (Android):** con el Modo Entrenamiento abierto, la serie aparece en la pantalla de bloqueo con **Hecha**, **Saltar descanso** y **+30 s**. Toca la flecha de la notificación para ver los botones. Con el móvil bloqueado, lo que marques queda en el dispositivo y se sube cuando vuelvas a abrir la app.\n\n## Modo: entrenamiento, foco o descanso\n\nEl botón **Modo** (barra lateral; en el móvil, **⚡ Modo** arriba de Hoy y de Inicio; o `Ctrl+K`) reúne los tres: **Entrenamiento** abre el Modo Entrenamiento de una página de tarjetas o con series; **Foco** empieza un pomodoro; **Descanso** empieza un temporizador de 30 s a 5 min que avisa al final con sonido, vibración y notificación."
    },
    {
      "slug": "pomodoro",
      "title": "Pomodoro y tiempo",
      "body": "**Pomodoro:** 25 minutos de foco, 5 de pausa y una pausa larga cada 4 focos. Empiézalo en el panel de la tarea, con `P` en la tarea seleccionada o desde la paleta (`Ctrl+K`).\n\nAl terminar el foco llega una idea de pausa: tomar un café, tomar aire, estirarse. Cambia las ideas, su orden y las duraciones en **Perfil → Pomodoro**.\n\n## Registrar tiempo\n\n- El **cronómetro** de la tarea: en el panel o `Shift+T`.\n- **Registrar a mano**: escribe `45m`, `1h30 ayer` o `30 14/10`.\n- Cada pomodoro terminado también cuenta.\n\nEl panel muestra \"Hecho: 1h20 de 2h\" (frente a la estimación) y la madre suma sus subtareas. En **Perfil → Pomodoro** ves hoy, la semana y dónde se fue el tiempo; en el proyecto, el tiempo por lista y por persona."
    },
    {
      "slug": "enviar-pagina",
      "title": "Enviar una página (un entrenamiento para un alumno)",
      "body": "Arma la página (un entrenamiento, un menú, una tarea escolar) y, en su menú, toca **Enviar a…**.\n\n- **En vivo** — sigues ajustando; quien recibe ve los cambios y marca su propio progreso. Cada alumno solo ve el suyo.\n- **Copia** — la persona recibe una copia que pasa a ser suya.\n\nEnvía por **enlace** (WhatsApp, por ejemplo) o por **correo**. Quien no tiene cuenta la crea ahí y llega directo a la página.\n\n## Quien recibe\n\nLa página aparece en **Recibidas**. Puede marcar, registrar series y carga, dejar una **observación** (\"me dolió el hombro\") y usar el modo Entrenamiento, también sin internet.\n\n## Panel Alumnos\n\nEn la página enviada, el botón **Alumnos** muestra a cada uno: cuánto hizo esta semana, la adherencia de las últimas 4 semanas, la evolución de las cargas y las observaciones. Puedes **recordar** a quien desapareció y **archivar** a quien dejó."
    },
    {
      "slug": "organizar-o-dia",
      "title": "Organizar el día y automatizar",
      "body": "- **Mi día** — elige lo que harás hoy (`M` o en el panel), ordénalo y di cuánto tiempo tienes: la app muestra si cabe.\n- **Hacer ahora** — la sugerencia de qué hacer después: lo que ya empezó, tu día, lo atrasado.\n- **Posponer** — el despertador de la fila (o `Z`) la lleva a mañana.\n- **Campos** — en el menú de la página, crea campos como Valor, Fase o Comprador.\n- **Aprobación** — una tarea que solo una persona (o quien gestiona) puede completar: el dueño aprueba el presupuesto antes de comprar.\n\n## Automatizaciones\n\nEn un proyecto, **Automatizaciones** crea reglas \"cuando… entonces…\". Ejemplo: cuando se complete una tarea de la lista Día, crear \"Limpiar la parrilla\" en la lista Después. Hasta 20 por proyecto; si una acción no puede ejecutarse, aparece en las últimas ejecuciones y no se pierde nada."
    },
    {
      "slug": "perguntas",
      "title": "Preguntas frecuentes",
      "body": "**Borré algo sin querer.** Usa Deshacer en el aviso. Después, Perfil → **Papelera** lo guarda 30 días.\n\n**Mi tarea desapareció de Hoy.** Se completó, se pospuso o cambió de fecha. Búscala con `Ctrl+K`.\n\n**¿Por qué no gané XP?** Completada justo después de crearla, desmarcada, o es una tarea madre. Mira \"XP, racha y jefes\".\n\n**El aviso del descanso no sonó en el ordenador.** El navegador solo avisa con la pestaña abierta (puede estar oculta) y con permiso de notificaciones.\n\n**¿Cómo exporto mis datos?** Perfil → Privacidad → Exportar (JSON o CSV).\n\n**¿Cómo salgo de un proyecto?** En el proyecto, **Personas** → **Salir del proyecto**.\n\n**¿Se puede usar sin la parte de juego?** Sí: Perfil → Gamificación.\n\n**¿Dónde cambio el idioma?** Perfil → Idioma.\n\n**El aviso del temporizador no vibra / no aparece.** Perfil → Avisos → **Avisos del temporizador**: mira si las notificaciones están permitidas y usa **Probar aviso**. El iPhone en el navegador y los ordenadores no vibran.\n\n**¿Hay app para el móvil?** Para Android, sí: Perfil → **App para Android** → Descargar la app (APK). Abre el archivo y permite instalar desde esta fuente. Para actualizar, descárgala de nuevo e instálala encima. Para iPhone, aún no."
    }
  ],
  "pt-BR": [
    {
      "slug": "comecando",
      "title": "Começando em 1 minuto",
      "body": "Escreva no campo **Nova tarefa** e aperte Enter. Pronto: a tarefa foi para a Caixa de entrada (ou para a página aberta).\n\n## Escrever rápido\n\nO próprio texto já preenche os detalhes:\n\n- `amanhã`, `sexta`, `15/10` — vencimento\n- `!`, `!!`, `!!!` — prioridade\n- `#mercado` — etiqueta\n- `/diaria`, `/semanal`, `/seg,qua` — repetir\n- `3x12` — 3 séries de 12; `x8` — fazer 8 vezes\n- `@ana` — responsável (em projeto)\n\nExemplo: `Pagar a luz sexta !! #casa` vira \"Pagar a luz\", vence sexta, prioridade média, etiqueta casa.\n\n## Várias de uma vez\n\nCole uma lista (uma por linha) ou toque em **Várias**. Linhas com recuo viram subtarefas. Antes de criar, você vê como vai ficar.\n\n## Marcar\n\nToque na caixinha. Errou? O aviso tem **Desfazer**."
    },
    {
      "slug": "pastas-projetos-paginas",
      "title": "Pastas, projetos e páginas",
      "body": "- **Página** é uma lista de coisas: compras, treino, roteiro da viagem. Pode ser **lista**, **cards** (bom para treino), **kanban** ou **hábitos**.\n- **Pasta** junta páginas suas. Exemplo: a pasta **Academia** com as páginas Treino A e Treino B.\n- **Projeto** é uma pasta para fazer **com outras pessoas**. Exemplo: o projeto **Churrasco** com as listas Compras e Dia, e cada amigo com as tarefas dele.\n\n## Quando usar cada um\n\n- Só você, assunto que se repete: **pasta**.\n- Mais gente, algo com começo e fim: **projeto**.\n- Um treino para um aluno, um cardápio para um paciente: **envie a página** (veja \"Enviar uma página\").\n\n## Reinício\n\nUma página pode **reiniciar** os checks todo dia, toda semana ou quando você mandar. Ótimo para treino semanal e rotinas.\n\n## Mover\n\nNo menu da página, **Mover para…** leva a página (com as tarefas) para outra pasta ou projeto."
    },
    {
      "slug": "criar-rapido-avancado",
      "title": "Criar rápido ou com detalhes",
      "body": "**Rápido:** o campo Nova tarefa. Escreva e aperte Enter. Serve para quase tudo.\n\n**Com detalhes:** o botão ao lado do campo, o menu **Novo** ou `Alt+Shift+N`. Abre um painel com página, descrição, vencimento, prioridade, repetição, séries e etiquetas. `Ctrl+Enter` cria.\n\n## Editar depois\n\nToque na seta da tarefa (ou `Enter` com ela selecionada) para abrir o **painel**: descrição (até 10.000 caracteres; vazia, aparece \"+ Adicionar descrição\"), data, prioridade, peso, tempo, subtarefas, quem faz, dependências, campos da página e comentários. Cada campo salva sozinho ao sair dele.\n\nNo topo do painel, **Simples ▾** mostra só o essencial; troque para **Completo** para ver tempo, séries, peso, dependências, campos, aprovação, Meu dia e histórico. O que a tarefa já usa aparece mesmo no Simples.\n\n## O menu Novo\n\n`Alt+N` (ou o botão **Novo**) e uma letra: **T** tarefa, **P** página, **F** pasta, **J** projeto, **H** hábito.\n\n## Anexos\n\nNo painel, **Anexar** põe uma foto (da galeria ou, no celular, da câmera) ou um arquivo na tarefa. Fotos são reduzidas no aparelho antes de enviar (cabem num quadrado de 2048 px), então ocupam pouco; a lista mostra só a miniatura e a foto grande baixa quando você abre. Cada arquivo pode ter até **10 MB**, e cada conta tem **1 GB** (veja quanto usa no Perfil). Quem vê a tarefa vê os anexos; quem pode editá-la anexa e remove. Sem internet, o anexo espera no aparelho e sobe sozinho depois."
    },
    {
      "slug": "editar-f2",
      "title": "Editar rápido com F2",
      "body": "Selecione uma tarefa (clique nela ou use `J` e `K`) e aperte **F2**: o título vira um campo. Enter salva, Esc desiste.\n\nSem tarefa selecionada, **F2** renomeia a página ou a pasta aberta, e dá para trocar o **ícone** ali mesmo.\n\n## Outros atalhos da lista\n\n- `Espaço` ou `X` — concluir\n- `1`, `2`, `3` — prioridade\n- `D` — data · `Z` — adiar para amanhã\n- `M` — pôr no Meu dia\n- `S` — iniciar · `P` — pomodoro · `Shift+T` — cronômetro\n- `Delete` — apagar (com Desfazer)\n\nA lista completa está em **Atalhos**, mais abaixo, ou aperte `?`."
    },
    {
      "slug": "time",
      "title": "Trabalhando com outras pessoas",
      "body": "Num projeto, abra **Pessoas** e toque em **Gerar link de convite**. Mande o link: quem abrir cria a conta ali mesmo e entra.\n\nAntes de convidar, dá para escrever `@gregory` nas tarefas. Quando o Gregory entrar, ele diz \"sou o @gregory\" e as tarefas passam a ser dele.\n\n## Cargos\n\n- **Dono** — tudo, inclusive apagar o projeto\n- **Gerente** — tudo menos apagar o projeto\n- **Editor** — trabalha em tudo, não mexe em pessoas\n- **Colaborador** — cria e faz as tarefas dele\n- **Leitor** — só vê e comenta\n\nTimes podem ter **cargos personalizados**, escolhendo permissão por permissão.\n\n## Eu levo\n\nEm tarefa sem ninguém, o botão **Eu levo** coloca você como responsável. Ótimo para dividir o churrasco."
    },
    {
      "slug": "sem-internet",
      "title": "Funciona sem internet",
      "body": "Depois da primeira sincronização, o app guarda seus dados **no aparelho**. Sem sinal, você continua criando, marcando, editando e treinando. Quando a conexão volta, tudo sobe sozinho, na ordem em que você fez.\n\n## O pontinho de sincronização\n\n- **Verde** — tudo em dia\n- **Amarelo** — enviando ou recebendo\n- **Vermelho** — sem conexão (o que você faz fica guardado) ou algo foi recusado; abra para ver qual\n\nToque nele (ou em Perfil → Sincronização) para ver a fila e forçar o envio.\n\n## Conflitos\n\nSe você e outra pessoa mudarem a mesma tarefa sem internet, vale a última mudança **de cada campo**. Na descrição, a versão que perdeu fica guardada: aparece \"Ver versão anterior\".\n\n## O que precisa de conexão\n\nConvites, painel de alunos, automações, relatórios e loja."
    },
    {
      "slug": "gamificacao",
      "title": "XP, sequência e bosses",
      "body": "Concluir dá **XP**. XP sobe o **nível**. Fazer algo todo dia mantém a **sequência**.\n\nTodo dia nasce um **boss do dia** (umas 6 tarefas) e toda semana um **boss da semana** (uns 5 dias de uso). Cada tarefa ou hábito é um golpe que vale para os dois ao mesmo tempo (e para o do clã). O do dia dá uma recompensa menor e conta uma sequência própria; o da semana dá XP, ouro e um item. O aviso de conclusão mostra quanto sobrou de cada um.\n\n## Justo, sem truque\n\n- Criar e concluir na hora não vale XP (vale o golpe).\n- Desmarcar devolve o que ganhou.\n- Tarefa-mãe com subtarefas não dá XP: as subtarefas dão.\n- Pomodoro dá um bônus pequeno, até 4 por dia.\n- Cada hábito \"bom e ruim\" vale até 10 \"+\" por dia, e tarefas criadas e concluídas em poucos minutos têm um teto diário. Quando um limite chega, o aviso diz.\n\n## Personagem\n\nEscolha uma **classe**, distribua **atributos** e use uma habilidade por dia. O ouro compra itens na **loja** (só visual).\n\n## Desligar\n\nPerfil → **Gamificação**. O app vira só lista de tarefas."
    },
    {
      "slug": "subtarefas",
      "title": "Subtarefas e níveis",
      "body": "Uma tarefa pode ter **subtarefas**, e elas também. O limite padrão é **4 níveis** (dá para mudar por página ou projeto).\n\n## Criar\n\n- No painel da tarefa, em **Subtarefas**.\n- Na lista, `Tab` recua (vira filha da de cima) e `Shift+Tab` volta.\n- No lote, use recuo: dois espaços por nível.\n\n## Como conta\n\nA mãe é um **pacote**: o progresso dela é o das subtarefas (\"2/5\"), e ela se conclui sozinha quando a última fecha. O peso de cada subtarefa (1 a 5) muda quanto ela conta.\n\n## Códigos\n\nAperte `W` para ver códigos como **1.2.3**. A visão **Estrutura** mostra a árvore inteira, e o menu da página exporta em texto."
    },
    {
      "slug": "dependencias",
      "title": "Tarefas que dependem de outras",
      "body": "No churrasco, **acender o fogo** depende de **comprar carvão**. Ligue as duas: no painel do fogo, em **Depende de**, escolha \"Comprar carvão\" (ou escreva `^carvão` ao criar).\n\nEnquanto o carvão não for comprado, o fogo fica **bloqueado** (cadeado) e mostra \"Aguardando: Comprar carvão\". Quando alguém comprar, o fogo fica **pronto** e quem cuida dele recebe um aviso.\n\n## Estrito ou flexível\n\nNo projeto, o modo **estrito** não deixa começar o que está bloqueado. O **flexível** deixa forçar, e registra quem forçou.\n\n## Lista que espera lista\n\nUma lista inteira pode esperar outra chegar a 50%, 75% ou 100% (Configurar página → Libera depois de).\n\n## Atalhos\n\n`L` liga a tarefa selecionada a outra. `S` inicia."
    },
    {
      "slug": "fluxo-projeto",
      "title": "Entendendo o projeto",
      "body": "O projeto tem quatro abas:\n\n- **Lista** — as listas, o progresso, os marcos, o boss do projeto e \"como o fluxo está indo\": o que mais segura o projeto, o caminho crítico e quem tem tarefas atrasadas.\n- **Fluxo** — o mapa das dependências, da esquerda para a direita. **Você está aqui** marca o que já pode ser feito; \"Sua vez\" são as suas. Também em lista, para quem prefere.\n- **Pessoas** — cada pessoa com o que está **fazendo**, o que está **pronto**, o que está **esperando** e o que concluiu.\n- **Linha do tempo** — quem fez o quê e quando, com filtros e exportação em CSV.\n\nCada tarefa tem também o **Histórico** dela, no painel."
    },
    {
      "slug": "repeticoes-descanso",
      "title": "Séries, repetições e descanso",
      "body": "Escreva `Supino 4x12` e a tarefa pede **4 séries**. Na linha aparece **0/4**: cada toque conta uma série, e a última conclui (o XP vem aí). `x8` faz um contador: beber água 8 vezes.\n\n## Descanso\n\nDepois de cada série começa o **descanso** (60 s por padrão; mude em \"Quantas vezes\", no painel). A contagem aparece embaixo, com **−30**, **+30** e **Pular**. No celular, você é avisado mesmo com a tela bloqueada. No navegador, o aviso vem se a aba estiver aberta, mesmo escondida.\n\n## Modo Treino\n\nEm páginas de cards ou com tarefas que têm séries, **Iniciar treino** abre a tela cheia: exercício atual, série, carga, botão grande **Feita** (ou `Espaço`), `R` pula o descanso. Feito o último exercício, o treino fecha sozinho e um aviso curto mostra séries, tempo, volume e XP. Funciona sem internet e mantém a tela acesa.\n\n**Sem destravar o celular (Android):** com o Modo Treino aberto, a série aparece na tela de bloqueio, com **Feita**, **Pular descanso** e **+30 s**. Toque na setinha da notificação para ver os botões. Com o celular travado, o que você marca fica no aparelho e sobe quando você abrir o app de novo.\n\n## Modo: treino, foco ou descanso\n\nO botão **Modo** (barra lateral; no celular, **⚡ Modo** no topo da Hoje e do Início; ou `Ctrl+K`) reúne os três: **Treino** abre o Modo Treino de uma página de cards ou com séries; **Foco** começa um pomodoro; **Descanso** começa um timer de 30 s a 5 min, que avisa no fim com som, vibração e notificação."
    },
    {
      "slug": "pomodoro",
      "title": "Pomodoro e tempo",
      "body": "**Pomodoro:** foco de 25 minutos, pausa de 5, e uma pausa longa a cada 4 focos. Comece no painel da tarefa, com `P` na tarefa selecionada ou pela paleta (`Ctrl+K`).\n\nNo fim do foco vem uma sugestão de pausa: buscar um café, tomar um ar, alongar. Mude as sugestões, a ordem e as durações em **Perfil → Pomodoro**.\n\n## Registrar tempo\n\n- **Cronômetro** da tarefa: no painel ou `Shift+T`.\n- **Lançar à mão**: escreva `45m`, `1h30 ontem` ou `30 14/10`.\n- Cada pomodoro concluído também conta.\n\nO painel mostra \"Feito: 1h20 de 2h\" (comparando com a estimativa) e a mãe soma as subtarefas. Em **Perfil → Pomodoro** você vê hoje, a semana e onde o tempo foi; no projeto, o tempo por lista e por pessoa."
    },
    {
      "slug": "enviar-pagina",
      "title": "Enviar uma página (treino para um aluno)",
      "body": "Monte a página (um treino, um cardápio, uma lição) e, no menu dela, toque em **Enviar para…**.\n\n- **Ao vivo** — você continua ajustando; quem recebe vê as mudanças e marca o progresso dele. Cada aluno só vê o próprio.\n- **Cópia** — a pessoa ganha uma cópia, que passa a ser dela.\n\nMande pelo **link** (WhatsApp, por exemplo) ou por **e-mail**. Quem não tem conta cria uma ali e cai direto na página.\n\n## Quem recebe\n\nA página aparece em **Recebidas**. Dá para marcar, registrar séries e carga, deixar uma **observação** (\"senti o ombro\") e usar o Modo Treino, também sem internet.\n\n## Painel Alunos\n\nNa página enviada, o botão **Alunos** mostra cada um: quanto fez nesta semana, a aderência das últimas 4 semanas, a evolução das cargas e as observações. Dá para **lembrar** quem sumiu e **arquivar** quem parou."
    },
    {
      "slug": "organizar-o-dia",
      "title": "Organizar o dia e automatizar",
      "body": "- **Meu dia** — escolha o que vai fazer hoje (`M` ou no painel), coloque em ordem e diga quanto tempo tem: o app mostra se cabe.\n- **Fazer agora** — a sugestão do que fazer em seguida: o que já começou, o seu dia, o atrasado.\n- **Adiar** — o despertador na linha (ou `Z`) leva para amanhã.\n- **Campos** — no menu da página, crie campos como Valor, Fase ou Comprador.\n- **Aprovação** — uma tarefa que só uma pessoa (ou quem gerencia) pode concluir: o dono aprova o orçamento antes da compra.\n\n## Automações\n\nNo projeto, **Automações** cria regras \"quando… então…\". Exemplo: quando uma tarefa da lista Dia for concluída, criar \"Limpar a churrasqueira\" na lista Depois. Até 20 por projeto; se uma ação não puder rodar, ela aparece nas últimas execuções e nada se perde."
    },
    {
      "slug": "perguntas",
      "title": "Perguntas frequentes",
      "body": "**Apaguei sem querer.** Use Desfazer no aviso. Depois disso, Perfil → **Lixeira** guarda por 30 dias.\n\n**Minha tarefa sumiu da Hoje.** Ela foi concluída, adiada ou mudou de data. Procure com `Ctrl+K`.\n\n**Por que não ganhei XP?** Concluída logo depois de criar, desmarcada, ou é uma tarefa-mãe. Veja \"XP, sequência e bosses\".\n\n**O aviso do descanso não tocou no computador.** O navegador só avisa com a aba aberta (pode estar escondida) e com a permissão de notificação dada.\n\n**Como exporto meus dados?** Perfil → Privacidade → Exportar (JSON ou CSV).\n\n**Como saio de um projeto?** No projeto, **Pessoas** → **Sair do projeto**.\n\n**Dá para usar sem a parte de jogo?** Sim: Perfil → Gamificação.\n\n**Troco o idioma onde?** Perfil → Idioma.\n\n**O aviso do timer não vibra / não aparece.** Perfil → Avisos → **Avisos do timer**: veja se a notificação está permitida e use **Testar aviso**. iPhone pelo navegador e computador não vibram.\n\n**Tem app para o celular?** Para Android, sim: Perfil → **App para Android** → Baixar o app (APK). Abra o arquivo e permita instalar desta fonte. Para atualizar, baixe de novo e instale por cima. Para iPhone, ainda não."
    }
  ]
};
