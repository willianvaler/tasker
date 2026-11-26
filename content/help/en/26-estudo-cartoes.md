# Review cards (spaced repetition)

Any note can hold study cards. Write a line with the **question**, `?::` and the **answer**:

```
Capital of France ?:: Paris
- Powerhouse organelle ?:: Mitochondria
```

Each such line becomes a card when the note is saved. A list marker (`-`, `1.`) is not part of the question, and lines inside a code block don't become cards. Deleting the line deletes the card and its reviews. Changing only the **answer** (or the order of the lines) keeps the history; changing the **question** starts a new card.

## Today's review

**More → Review cards** (or Ctrl+K) holds today's session, with "Today: N cards" at the top: first the **due** cards, most overdue first, then the **new** ones, in note order. In the **⋯** of a note with cards, **Review cards** opens only that note's cards.

Think of the answer, tap **Show answer** and say how it went. Each button shows when the card comes back:

- **Again**: back tomorrow, and once more at the end of this session.
- **Hard**, **Good** or **Easy**: the interval grows (1 day, 6 days, then the previous interval times the card's ease). **Easy** raises the ease; **Hard** lowers it.

The math is **SM-2** (the SuperMemo algorithm, public domain), with one tweak: a miss takes little from the ease, so a hard card doesn't get stuck.

## Daily limits

By default, **20 new cards** and **200 reviews** a day. Change them in **Daily limits** (the button at the top). Whatever goes past the limit waits for tomorrow, and the screen says how many.

## Offline and on two devices

Reviewing works offline. Each answer is stored with its time, and a card's state is always rebuilt in time order: reviewing on the phone and on the computer, even offline, ends in the same result once both sync. Cards from a note created or edited offline show up after it syncs.

In project notes, project members see the cards, and each person has their **own** reviews. Reviewing gives no XP or gold.
