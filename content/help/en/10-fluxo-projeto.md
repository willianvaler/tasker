# Understanding the project

A project has five tabs:

- **List** — the lists, progress, milestones, the project boss and "how the flow is going": what's holding the project back, the critical path and who has overdue tasks.
- **Flow** — the dependency map, left to right. **You are here** marks what can be done now; "Your turn" are yours. Also as a list, if you prefer.
- **Gantt** — one bar per dated task, from its **start** to its **due date**, with dependency arrows and a line for today. Drag a bar to change both dates, or an edge to change just the start or the end; tapping a bar opens a menu that does the same one day at a time (handy on a phone, where you hold before dragging). Orange border: the task starts before a prerequisite ends. Tasks without a date sit below: one tap sets them for today. You can also change the start in the task panel, under **Starts on**. **Save baseline** stores the current dates (up to 5 per project, for whoever manages the structure); tapping a baseline draws the thin plan bar under each task with the delay in days ("+3 d"), and the summary says how many slipped, how many were added and how many were removed since. The indicators compare with the newest one.
- **People** — each person with what they're **doing**, what's **ready**, what's **waiting** and what they finished.
- **Timeline** — who did what and when, with filters and CSV export.

Each task also has its own **History**, in the panel.

## Milestones and roadmap

Project **milestones** (in the overview, "New milestone") get a **Roadmap**: milestones by date, each with its linked tasks, a progress bar, how many are overdue and how many blocked. A milestone whose date has passed with open tasks gets a red border; below, you see how many open tasks have no milestone.

To link a task to a milestone, pick it in the **task panel** (Milestone section) or write `~name` when creating, like `Buy the flooring ~Delivery` (works in quick add and Add several; the name is compared without accents, spaces or punctuation). An unknown milestone doesn't link and shows a notice.

In the **Gantt**, each milestone is a diamond on its date at the top of the grid; tapping opens a menu to move the date day by day or open the Roadmap. When you **complete the milestone** in the Roadmap, **Release notes** creates a note in the project with what was done and what was left for later, ready to copy or publish.
