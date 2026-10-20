# Tasks that depend on others

At the barbecue, **light the fire** depends on **buy charcoal**. Link them: in the fire's panel, under **Depends on**, pick "Buy charcoal" (or type `^charcoal` when creating).

Until the charcoal is bought, the fire is **blocked** (padlock) and shows "Waiting for: Buy charcoal". When someone buys it, the fire becomes **ready** and whoever owns it gets a notice.

## Typing with ^

When creating a task, `^` followed by part of a name links the new task to an existing one: `Light the fire ^charcoal`. Matching tasks show up as you type; Enter picks one. In a batch, `^2` points to item 2 of the same list. It works in projects and in your own folders, between tasks of the same folder (and its subfolders).

**Depends on** is always visible in the task panel. The folder's **Flow** tab shows who waits for whom.

## Strict or flexible

In the project, **strict** mode doesn't let you start what's blocked. **Flexible** lets you force it, and records who did.

## A list waiting for a list

A whole list can wait for another to reach 50%, 75% or 100% (Page settings → Unlocks after).

## Shortcuts

`L` links the selected task to another. `S` starts it.
