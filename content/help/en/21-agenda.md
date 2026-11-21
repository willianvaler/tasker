# Schedule and availability

Your **availability** says when you accept appointments. It lives in **Settings → Schedule → Availability** and follows your profile's time zone. The booking page (for someone to book a time with you) and the group **Find a time** use these hours, and people outside see only **free** or **busy**, never what you have scheduled.

## The week

Each day has a field. Write one or more ranges separated by commas: `9-12, 14-18`, `9h às 12h`, `9:00–12:00` or `9am to 5pm`. When you leave the field it shows how it was read (`09:00–12:00, 14:00–18:00`). Ranges that touch or overlap become one. An empty day has no hours. To go until midnight, end with `24` (`20-24`).

**Copy Monday to weekdays** repeats Monday's hours from Tuesday to Friday. Then **Save**. Below you see the weekly hours and how the **next 7 days** will look, exceptions included.

## Exceptions

For a day off, a trip or a commitment outside the app, add an **exception**: the start date (`12/24`, `tomorrow`, `Friday`), the end date if it spans several days, and **hours** if it is only part of the day (`14-16`; empty blocks the whole day). The reason is optional and only you see it. The **×** removes the exception. Past ones disappear from the list.

## Booking page

In **Settings → Schedule → Appointments** you create **appointment types** (e.g. "30-minute chat"): duration, buffers before and after, minimum notice, how many days ahead, a daily limit, whether to ask for a phone and "what it's about", and whether a booking **needs your approval**. Each type has a link (`/agenda/<your nick>/<type>`), and the schedule link (`/agenda/<your nick>`) lists every open type.

Whoever opens the link **needs no account**: they pick the day and time (in their time zone), write their name and email and confirm. Free times are your weekly hours minus exceptions, existing bookings and **tasks with a time** (lasting the task's estimate, or 30 min). If two people try the same time, the second one is told it was just taken.

A booking becomes a **task** in the **Bookings** list of the **Schedule** folder (created with the first booking), with the time, the duration and the answers in the description, and you get a notification. With approval, the booking stays pending (the time is already held) until you **Approve** or **Decline** it in Appointments; **Cancel** removes the task (it goes to the trash).

The guest gets an **Add to calendar (.ics)** button and a link to **reschedule** or **cancel**. We don't send email yet, so they need to keep the link. Guest data is deleted 1 year after the appointment.

## Find a time as a group

In a **project**, a **team** or the **clan**, the **Find a time** button picks the people (all checked already), the duration (30 min, 1 h, 1 h 30) and the next 7 or 14 days, and shows the times when **everyone is free**: within each person's week and outside what each already has (tasks with a time, bookings and exceptions). Nobody sees what fills the others' schedules, only that a time doesn't work. People without availability show as **no schedule** and don't limit; if nobody set it up, the search goes from 9 am to 6 pm.

Once you pick a time, **Create appointment** creates the task with that time and a reminder 15 min before: in the project, in one of its lists, with the people as assignees; in a team or the clan, in your Inbox.

## Offline

Setting up your availability needs a connection. It is included in **your data export** and is deleted with your account.
