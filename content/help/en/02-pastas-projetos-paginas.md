# Folders, projects and lists

- A **list** holds your things: groceries, a workout, a trip plan. Its type can be **Tasks**, **Routine** (a checklist in cards that resets; good for workouts), **Habits**, **Board** or **Expenses**. Every task list also opens as a **Board** (tab at the top). On the board, drag a card to another column (on the phone, hold the card before dragging) or use the card’s arrows. To open the task, tap the pencil on the card.
- A **folder** groups your lists. Example: the **Gym** folder with Workout A and Workout B.
- A **project** is a folder to do **with other people**. Example: the **Barbecue** project with Shopping and On the day lists, each friend with their own tasks.

## When to use which

- Just you, something recurring: **folder**.
- More people, something with a start and an end: **project**.
- A workout for a student, a meal plan for a patient: **send the list** (see "Sending a list").

## Reset

A list can **reset** its checks every day, every week or when you say so. Great for weekly workouts and routines.

## Moving

In the list menu, **Move to…** takes the list (with its tasks) to another folder or project.

To change the order without dragging, use **Move up** and **Move down** in the folder or list menu (on the keyboard, **Alt+↑** and **Alt+↓** with it open).

## Gym

If you said you will use the app to work out (or turned on **Workouts** in Settings → Features), the sidebar gets the **Gym** block, with your workouts. **+ New workout** creates the workout list right there, already as cards and resetting every week. Turning the mode off deletes nothing: the Gym folder goes back to Folders.

## Sidebar

In **Settings → Navigation** you change the order of the blocks (Notes, Folders, Gym, Projects, Received) and hide the ones you don't use. It applies on all your devices.

On a computer, **right-clicking** a folder (in the sidebar or the Folders tab), a list, a project, a milestone or a medication opens the same menu as the row's **…** button.

## Notes

**New note** (sidebar, the **+** menu or More → Notes) opens a free text, just for you. The bar on top formats it: **bold**, _italic_, heading, list, numbered list and checklist. You can also type it: `**bold**`, `_italic_`, `## heading`, `- item`, `- [ ] task`. **Preview** shows the formatted text; **Edit** goes back to the text. It saves on its own.

Inside a **folder or project**, the **Notes** section keeps the folder’s texts (agreements, minutes, ideas): everyone in the folder reads them, and whoever can create tasks there writes. They do not show up in your personal notes.

### Commands, callouts and more

Type **/** at the start of a line to open the **commands**: heading, subheading, lists, task, callout (note, tip, warning), table, link, highlight, footnote, code block and divider. Keep typing to filter (`/tab` finds Table) and confirm with Enter or a tap.

- **Callout**: a colored box. Write `> [!tip] Title` and, on the lines below, `> the text`. Types: note, tip, warning, danger, question, info, success and quote (Obsidian's names work too). With `-` after the type (`> [!warning]- Title`) it starts closed and opens on tap; with `+`, it starts open and can be closed.
- **Highlight**: `==text==` gets a background.
- **Footnote**: `[^1]` in the text and, on any line, `[^1]: the explanation`. The reference becomes a small number and the notes show at the end.
- **Table**: lines with `|` between the columns and `| --- | --- |` under the header.

The **Outline** lists the note's headings: on a computer it sits next to the text; on a phone, behind the outline button in the bar. Tap a heading to scroll to it. Below the editor you see the **word** and character count.

### Properties and tags

While editing, **Property** (below the title) adds a field to the note: author, rating, read, deadline… Each has a type: text, number, date, checkbox, list or link (`[[Note]]`). Tap the name to change the type or remove it. Two have a special meaning: **tags** and **aliases** (other names for the note, which `[[` and unlinked mentions also recognize).

To tag, write `#tag` in the text or put it in the tags property. Use a slash to nest: `#workout/legs` sits inside `#workout`. Tapping a tag opens the **Tags** screen (also in More and Ctrl+K), which gathers the tags of notes and tasks; a parent tag also shows what is in its children.

### Daily note and templates

**Daily note** (the notebook button on Today, in Notes, in Ctrl+K or `Alt+D`; if your browser takes `Alt+D`, `G D`) opens today's note, titled with the day (`2026-11-03`), and creates it if it does not exist yet. Below it, in preview, the tasks **completed** and **created** that day show up, like an automatic journal. In the **Calendar**, days with a note get a dot, and the day list has a button to open (or write) the note.

A **template** is a note used as a starting point. In Notes → **Templates**, **New template**; or, in a note, **More options** → **Turn into a template**. Templates do not show in lists. In the template text, `{{date}}`, `{{time}}` and `{{title}}` become the day, the time and the title when it is used. **From template** (in Notes) creates a note from one of them, and **Use for the daily note** makes every new daily note start with it.

### Links between notes, tasks and lists

Type `[[` (or tap the link button on the bar) and start typing: your notes (most recent first), tasks, lists and projects show up. Pick one and the link goes into the text. In the preview it shows only the name, and tapping it opens the item. Renaming the item doesn't break the link. You can also jump to a heading of a note with `[[Note#Heading]]`.

The last option creates a link to something that **doesn't exist yet** (`[[New idea]]`). It shows faded, and tapping it creates the note with that name.

Below the note, **Linked from** shows the notes and tasks that link to it, with the sentence around the link. **Outgoing links** lists what it links to. **Unlinked mentions** shows your notes that write its name without `[[ ]]`, and **Link** turns the mention into a link. A task's description also accepts `[[`, and the task panel and the top of a list show **Linked from**. It works offline.

**Embed:** a line with only `![[...]]` (a `!` before the link, or the `/embed` command) shows the item inside the note: another note (whole, or just a section with `![[Note#Heading]]`), a list with real checkboxes (completing there completes it in the list), a task, or an image from your task attachments by file name (`![[photo.jpg]]`). On a computer, resting the mouse on a link shows a preview with the first lines; on a phone, touch and hold.

## Shopping list from a menu

On a menu list (of type Tasks or Routine), each dish is a task and the ingredients are its **subtasks** or the lines starting with `-` in its **notes** ("- 500 g ground beef", "- 2 eggs"). In the list menu, **Make a shopping list** puts everything in one list, adding up what repeats (500 g + 300 g of beef become 800 g; kg and liters count too), and asks where it goes: a list in the same folder, a new "Shopping" list or the Inbox. Before creating, the list shows up in batch creation so you can check it. Completed dishes are left out (if they are all completed, all of them count).
