# Folders, projects and lists

- A **list** holds your things: groceries, a workout, a trip plan. Its type can be **Tasks**, **Routine** (a checklist in cards that resets; good for workouts), **Habits**, **Board**, **Expenses**, **Base** or **Canvas** (see Notes). Every task list also opens as a **Board** (tab at the top). On the board, drag a card to another column (on the phone, hold the card before dragging) or use the card’s arrows. To open the task, tap the pencil on the card.
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

On a computer, drag the sidebar's **right edge** to change its width, and the **line between the shortcuts** (Today, Plan…) **and the blocks** to give more room to folders and notes: the shortcuts shrink and scroll inside. Double-click the line to show them all again.

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

### Queries

A ` ```questlist ` fence (or the `/query` command) shows, inside the note, the tasks or notes that match a question written in words:

```
tasks where tag = home and due <= today+7 sort by due
tasks in list "Groceries" not done
notes where tag = reading and props.rating >= 4 as table
tasks in folder "Work" where priority >= high as count
```

Start with **tasks** or **notes**. Then, in any order: **in list "…"** or **in folder "…"**; **where** field sign value, joined with **and** (fields: tag, due, priority, title, status, created, updated and `props.name` for properties; signs: `=`, `!=`, `<`, `<=`, `>`, `>=` and **contains**; dates: `today`, `today+7`, `yesterday`, `tomorrow` or `2026-12-01`); **done** or **not done**; **sort by** field (with **desc** to reverse); **limit** number; and **as list**, **as table** or **as count**. The words also work in Portuguese and Spanish. In a list, tasks have real checkboxes. The query runs on the device, offline too, and needs a filter (list, folder, tag or date) so it does not read everything: without one, it warns and does not run.

### Links between notes, tasks and lists

Type `[[` (or tap the link button on the bar) and start typing: your notes (most recent first), tasks, lists and projects show up. Pick one and the link goes into the text. In the preview it shows only the name, and tapping it opens the item. Renaming the item doesn't break the link. You can also jump to a heading of a note with `[[Note#Heading]]`.

The last option creates a link to something that **doesn't exist yet** (`[[New idea]]`). It shows faded, and tapping it creates the note with that name.

Below the note, **Linked from** shows the notes and tasks that link to it, with the sentence around the link. **Outgoing links** lists what it links to. **Unlinked mentions** shows your notes that write its name without `[[ ]]`, and **Link** turns the mention into a link. A task's description also accepts `[[`, and the task panel and the top of a list show **Linked from**. It works offline.

**Embed:** a line with only `![[...]]` (a `!` before the link, or the `/embed` command) shows the item inside the note: another note (whole, or just a section with `![[Note#Heading]]`), a list with real checkboxes (completing there completes it in the list), a task, or an image from your task attachments by file name (`![[photo.jpg]]`). On a computer, resting the mouse on a link shows a preview with the first lines; on a phone, touch and hold.

### Bases

A **Base** list shows, on one screen, the tasks or notes that match a query (the same language as the ` ```questlist ` block above), as a **Table** or **Cards**. It starts with `tasks where due <= today+7 not done`; change the text and tap **Apply** (or `Ctrl+Enter`). **Columns** picks what shows (for notes, properties become columns too), **Group** groups by status, list, tag, priority or a property, and tapping a column name sorts it (ascending, descending and back to the query's order). In the table, tap a cell to edit: title, due date (`2026-12-01`), priority (`0` to `3` or `!!`) and tags on tasks; title and properties on notes (a checkbox flips with one tap). Tasks have the real checkbox, and the arrow at the end of the row opens the item. The setup is saved in the list and is the same for everyone in the project; read-only members can see it but not change it.

### Graph

**Graph** (in Notes, More or Ctrl+K) draws notes, tasks, lists and folders as nodes and the `[[...]]` links as lines; the more a node is linked, the bigger it is, and a link to something that doesn't exist yet shows hollow. Filter by type, tag, folder or project, and hide **Orphans** (no links at all). **Search the graph** focuses on an item and shows only what is linked to it, 1, 2 or 3 steps away. On a computer, the mouse wheel zooms, dragging moves the view and the nodes, and clicking opens the item (a hollow one creates the note); on the phone, scroll and use the zoom buttons. Below each note, in preview, the **Local graph** shows its neighbors up to 2 steps away, with **Open in graph**.

### Canvas

A **Canvas** list is an infinite whiteboard. On a computer: **Text** adds a text card (double-click to edit), **Card** adds a real note, task, list or folder (the task on the canvas is the same task, and its checkbox completes it), **Link** shows a web link or image, and **Group** adds a named area to gather cards. Drag to move, pull the edge of a selected card to resize, and drag an arrow from the dot on a card's edge to another card; double-click an arrow to label it. With something selected, pick a **Color** or **Remove from canvas** (or `Delete`). **Export .canvas** and **Import .canvas** use the open JSON Canvas format, the same as Obsidian. On the phone the canvas shows as a list, by group, with tasks you can check. Changing the canvas requires permission to configure the list.

### Version history

Every note keeps versions on its own: one per editing session, at most one every 10 minutes. In **More** (the three dots at the top of the note) → **Version history**, pick a date to see what changes if you go back to it (− lines only it has, + lines only the current text has) and tap **Restore this version**; the current text is kept in the history, so you can undo. Versions are kept for 1 year, only you see them (even in a project note), and they **count toward your attachment space**; to free space, delete a version in the history or all of them in **Settings → Data**. Viewing and restoring needs an internet connection. A deleted note goes to the **Trash** with its versions and comes back whole.

### Favorites, search, split view and random

**Favorites:** in the note's **More**, or in the list menu, **Add to favorites**; they show at the top of the sidebar and on the Notes screen (the **×** removes one). A search can be a favorite too: type it in Ctrl+K and choose **Save the search to favorites**. **Search with operators** in Ctrl+K (looks in notes, tasks, lists and folders): `tag:home` (or `#home`, child tags count too), `in:Work` (folder or project), `type:note`, `type:task`, `type:list`, `type:folder`, `"exact phrase"` and `-word` to exclude; the names work in English, Portuguese and Spanish (`em:`, `tipo:`, `etiqueta:`). **Split view** (computer, wide window): in the note's **More**, **Open side by side** puts another note or a list on the right; the **×** closes it. **Random note** is on the Notes screen and in Ctrl+K.

## Shopping list from a menu

On a menu list (of type Tasks or Routine), each dish is a task and the ingredients are its **subtasks** or the lines starting with `-` in its **notes** ("- 500 g ground beef", "- 2 eggs"). In the list menu, **Make a shopping list** puts everything in one list, adding up what repeats (500 g + 300 g of beef become 800 g; kg and liters count too), and asks where it goes: a list in the same folder, a new "Shopping" list or the Inbox. Before creating, the list shows up in batch creation so you can check it. Completed dishes are left out (if they are all completed, all of them count).
