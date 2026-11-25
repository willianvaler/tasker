# Processes

A **process** is a flow that lasts: hours, days or weeks. It creates tasks for people, waits for deadlines and signals, picks the path and runs automatic steps on its own. It's different from an **automation** ("when X, do Y", done in seconds) and from a project's **Flow** tab (which only shows task dependencies). Open it in **Settings → Open processes**.

## Glossary

- **Process:** the design (steps and connections). Each **publish** creates a **version**; what's already running stays on the version it started with.
- **Instance:** one run of the process, with its own **variables** and **timeline**.
- **Step:** each box in the design.
- **Gate:** the **decision** (takes the first path whose condition is true, or the default) and the **parallel** (splits into paths at the same time and joins when all arrive).
- **Function:** a process other processes call, with **inputs** and **outputs**. In the Processes list, functions stay under **Advanced** until you create the first one.

## The steps

**Start**, **end** (or end with error), **automatic step** (the same actions as automations: notify, create task, update the task, webhook…), **task for someone**, **decision**, **parallel**, **wait for a time** (`PT2H`, `P1D`), **wait for a signal**, **call function**, **repeat** (up to 50 times) and **for each item** (up to 100).

The **task for someone** is a normal task: it shows on Today with the **Process** badge. It can have **choices** ("Approve", "Reject"), a **form** (what the person fills in becomes a variable) and a **deadline**, with a reminder before and, if it passes, its own path, another person or just a notice. Whoever received it can **give it back to the group**. If the person leaves the project, the task goes back to the group or to you. It **earns no XP**, unless you turn on "counts as a normal task".

## Edit, test and publish

The design is edited on the web: the **+** buttons add steps, you connect by dragging or with the **Connect two steps** form (which works with the keyboard alone), and the side panel shows the properties of the step or connection. **Undo**, **Redo**, **Duplicate** and **Auto layout** help. Errors show up right away, each pointing to the step, and a process with errors **won't publish**. **Simulate** runs through the design with test variables and shows the path and variables, without doing anything for real (no notification, no webhook). On the phone, the design is view-only.

Conditions and calculations use the same language as calculated fields, with `{var.name}` (variables), `{inicio.*}` (who started it) and `{retorno.*}` (what the last wait returned). Every variable used must be declared.

## Start from a note

In the **Start** step, pick **Starts when**: a note is created, a property changes (for example `status` becomes `Studying`), a tag is added or a note button is pressed. The process stays linked to the note, which shows the **Processes of this page** card. Note actions (append text at the end, set a property, add a tag, create from a template) never erase what's written, and what the process itself changes in the note doesn't start it again. Only stored properties trigger; calculated ones don't.

## Limits

Up to 200 steps per design, 2,000 steps per instance, 365 days, 500 running processes, 60 starts per hour and 5 functions nested. A failing step can retry (1, 5 and 30 min), take the error path or stop the process; when stopped, **Retry the failed step** tries again. **Pause all** (in Automations) also pauses processes.
