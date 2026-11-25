# Planning the day and automating

- **My day** — pick what you'll do today (`M` or in the panel), put it in order and say how much time you have: the app shows whether it fits.
- **Do now** — the suggestion of what to do next: what's already started, your day, what's overdue.
- **Snooze** — the alarm clock on the row (or `Z`) moves it to tomorrow.
- **Fields** — in the list menu, create fields like Cost, Stage or Buyer. The **Calculated** type does math with the others: `{Price} * {Quantity}`, `days_until({due})`, `if({Stage} = "Purchase", 1, 0)`. You can use numbers, `+ - * /`, comparisons (`=`, `!=`, `<`, `>`, `<=`, `>=`), text in quotes and the functions `if`, `days_until`, `today`, `round`, `min`, `max`, `abs`, `and`, `or`, `not` and `empty` (also in Portuguese and Spanish). Besides the list fields, a formula reads `{title}`, `{due}`, `{start}`, `{priority}`, `{estimate}`, `{time}` and `{done}`. The value is calculated on the spot; you don't type it. On a task with subtasks, number fields show **the total of the children**, and time shows what was logged on them.
- **Approval** — a task only one person (or a manager) can complete: the owner approves the budget before buying.

## Automations

In a project, **Automations** creates "when… then…" rules. Example: when a task in the On the day list is completed, create "Clean the grill" in the After list. Up to 20 per project. The rule runs on the server a few seconds after whatever triggered it, with the permissions of whoever created it; if an action can't run (that person left the project, the list is gone), it shows in the recent runs and nothing is lost.

## Eisenhower matrix

On a task list, the tabs at the top switch the view: **List**, **Board** (the kanban, with To do, Doing and Done columns) and **Matrix**. The **Matrix** splits the open tasks into four quadrants: **Do** (important and urgent), **Schedule** (important, no rush), **Delegate** (urgent, not very important) and **Drop** (neither). Important means priority `!!` or `!!!`; urgent means due by the day after tomorrow, overdue included. The button next to a task moves it to another quadrant: it adjusts the priority and, when needed, the date (due today, or a week from now). The list remembers the last tab used on this device.

## Saved views

The **+** next to the tabs creates a **view** of the same list, without copying anything: a name, how to show it (**List**, **Board**, **Table**, **Calendar** or **Gantt**), which tasks go in (open or completed, overdue, next 7 days, no date, with a tag, only the ones assigned to you), the order and the grouping. The view becomes a tab.

- **Board by field:** group by priority, assignee, tag or a select field (e.g.: Phase). Dragging the card to another column (or using the arrows) changes that value on the task; by status, it is the usual board.
- **Table:** pick the columns, including the list's fields. Tap a cell to edit it (title, dates, priority, tags and fields); the header sorts.
- **Calendar:** the month with the tasks by due date; the ones with no date are listed below.
- **Gantt:** bars from start to due date, only for this list.

In a project, a view can be **Only me** (only you see it) or **The whole project** (everyone sees it; creating and changing it requires permission to configure lists). The settings button next to the tabs edits or deletes the open view.

The **table footer** (in views and in Bases) shows each column's total: for numbers and money, the sum; tap to switch to average, minimum, maximum, how many are filled or nothing. For value columns (status, tag, select), a tap shows how many tasks have each value. In the table, a parent with no value of its own shows its subtasks' sum with a **Σ** in front.

## Weekly review

Once a week, Today suggests the **Weekly review**; it always lives in **Plan** (and in search, `Ctrl+K`). It has four steps: **Done** (what you did in the last 7 days, by list), **Left over** (overdue tasks: pick a new day, remove the date or complete them), **Stalled** (no date and untouched for more than 30 days: give a date or archive, which sends it to the trash) and **Next week** (what is due in the next 7 days). **Finish review** saves the date; "Not now" hides the prompt for a week.
