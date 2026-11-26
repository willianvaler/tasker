# Automations

An **automation** is a "when… if… then…" rule: **when** something happens (the trigger), **if** the conditions match, **then** the app runs the steps on its own, on the server. Yours live in **Settings → Automations**; a project's, in the project menu (**Automations**), for whoever can manage them.

## When: the trigger

In the editor, triggers are grouped: Tasks, Time, Notes, Game and Outside.

- **Tasks:** created, completed, became ready (what it waited for is done), assigned to you, overdue, or due in a few minutes. **Whole list completed.**
- **Game and project:** leveled up, boss defeated, milestone reached.
- **Clock:** at a time (with weekdays) or every N hours, always in your time zone.
- **Incoming call (webhook):** an address only for this automation; whatever arrives becomes `hook.*`.
- **Only when I run it:** runs from the **Run now** button.

Importing from Habitica or Todoist and using a template never trigger automations.

## If: the conditions

Optional. Combine with **AND** (all), **OR** (any) and **NOT**, up to 3 levels and 10 comparisons. There are ready-made ones — **time window** (22:00 to 06:00 crosses midnight), **weekdays**, **project**, **list**, **label** and **minimum level** — and comparing a value (`evento.titulo` contains "invoice", `evento.prioridade` ≥ 2). If the conditions don't match, the run shows in the history as "conditions: no".

## Then: the steps

Up to 20 steps: **notify** (in the app, on the phone or both), **create task** (due as a date or `+2` days), **update the task** (labels, list and due date), **assign** (in a project), **start a rest**, **wait** (1 minute to 7 days), **set a variable**, **if… else**, **run another automation**, **call a URL (webhook)**, **change game mode** and **stop**. An automation never completes, reopens or deletes a task.

In texts, `{{evento.titulo}}` is replaced by the value. Filters: `|corta:40`, `|data`, `|hora` and `|padrao:"no name"`. You can also use `{{usuario.nome}}`, `{{usuario.nivel}}`, `{{agora|hora}}` and `{{var.name}}` (a value set earlier). A variable that doesn't exist becomes empty text and leaves a warning in the history. English and Spanish names work too (`{{event.title|cut:40}}`).

The automation acts **as whoever created it**: it only does what that person can. If they leave the project, the action fails and shows in the history.

## Test, run and the history

**Test** shows what each step would do, with a sample of the trigger, without doing anything for real (no notification, no task, no call). **Run now** runs it for real. The **history** shows the last 50 runs, step by step, with the error when there is one.

## Limits

Each automation runs up to **60 times an hour**, and all of yours together, **600**; notifications, up to **10 an hour** per automation. Past that, the run is marked **limited** (it's not an error). The hourly usage shows in Automations when it gets close to the limit (80%). An automation that fails **10 times in a row** is turned off and you get a notification; turn it back on after fixing it. A trigger that runs more than 15 minutes late (server down) doesn't run and is marked **missed**. **Pause all** stops everything right away, including what was waiting.

## Call a URL (outgoing webhook)

Works with Discord (the channel webhook), a Home Assistant exposed to the internet, IFTTT and any service with an **https://** address. The body is JSON, and the texts inside it accept `{{ }}`. Passwords and header tokens (`Authorization`) are stored separately, encrypted, and never come back to the screen. Addresses on your home network and the server itself are blocked.

With **Sign**, every call carries `X-Questlist-Signature: t=<seconds>,v1=<signature>`, an HMAC-SHA256 of the text `t` + `.` + body, with the signing secret (shown once, when generated). To check it on your server (Node):

```js
const crypto = require('crypto');
function verify(header, body, secret) {
  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const recent = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return recent && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
```

Every call also carries `X-Questlist-Idempotency`: if it arrives twice with the same value, it's the same call.

### Recipe: post to a Discord channel

1. In Discord, open **Edit Channel → Integrations → Webhooks → New Webhook**, give it a name and tap **Copy Webhook URL**.
2. In Questlist, under **Settings → Automations**, pick the template **Post on Discord when leveling up** or **Post on Discord when defeating a boss**.
3. Under **Then**, paste the copied address in place of `https://discord.com/api/webhooks/` and adjust the `content` text (it accepts `{{evento.nivel}}` and `{{evento.boss_nome}}`).
4. **Test** shows what would be sent without sending anything; **Save** turns the automation on.

Discord shows the message with the webhook's name. The webhook address works like a password: anyone who has it can post to the channel. If it leaks, delete the webhook in Discord and create another. No sensitive data (health, location, camera, device) goes into the message.

### Sensitive data

Health, location, camera and device data (`{{saude.…}}`, `{{local.…}}`, `{{camera.…}}`, `{{dispositivo.…}}`) **don't go out** in a webhook: the automation stops with the warning "Sensitive data blocked" in the history. To send a field, release it in **Settings → Your data → Sensitive data in automations** (e.g. `saude.agua.ml`; releasing `saude.agua` covers everything inside it). Processes never send sensitive data.

## Receive a call (incoming webhook)

In an automation with the **Incoming call** trigger, **Generate address** shows the address **once** (keep it). Send a `POST` with JSON or a form, up to 16 KB; the answer is always `202`, with no body. **Change address** invalidates the old one at once. There's a per-minute limit; above it, the answer is `429`.

## QR and NFC link

A personal automation with the **manual** trigger can get a link: under **When**, tap **Create link**. The address and the QR code show up only once; use **Print the QR code** to stick it on a door, a desk or in the car. For NFC, write the same address to a tag with any NFC writer app: when you tap the phone on it, the system opens the link, with nothing to install in Questlist.

When the link opens, Questlist asks you to sign in (if needed) and runs the automation as you. Only your account can use the link: for anyone else it shows as invalid. By default the page asks you to tap **Run** first; turn off **Ask for confirmation when opened** to run it right away. An automation that calls a webhook or a device **always** asks. **Replace link** or **Revoke** makes the old QR codes and tags stop working at once. On Android, the link opens in the browser, where you are already signed in to Questlist.

## Notes

Created, property changed, tag added and button pressed are triggers; append text, set property, add tag, create from a template and **start a process** are actions. No action erases text.
