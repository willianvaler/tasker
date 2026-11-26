# Call Questlist from automation apps

Phone automation apps (Automate, MacroDroid, Tasker, iPhone Shortcuts, Samsung Routines) do what Questlist doesn't: read SMS, turn on Do Not Disturb, change brightness, react to other apps' notifications. Questlist doesn't touch the phone's system, but these apps can **call** one of your automations, in two ways:

- **Incoming call address** (incoming webhook): the app sends a `POST` with data (a task title, for example) and the automation runs on the server, without opening anything on screen. Needs an app with an **HTTP request** action.
- **Automation link** (`/r/…`, the same one used for QR and NFC): the app only **opens an address**. The browser opens Questlist, which runs the automation as you (asking for **Run** first, if it asks for confirmation). Works with any app that can open a website.

Both are in **Automations**, under the automation's **When**: **Incoming call (webhook) → Generate address**, or **Only when I run it → Create link**. See the **Automations** article.

## What each app can do

| App | HTTP request (incoming call) | Open the link |
|---|---|---|
| Automate (Android) | Yes, **HTTP request** block | Yes |
| MacroDroid (Android) | Yes, **HTTP Request** action | Yes |
| Tasker (Android) | Yes, **HTTP Request** action | Yes |
| Shortcuts (iPhone) | Yes, **Get Contents of URL** action | Yes |
| Samsung Routines (Modes and Routines, formerly Bixby Routines) | No | Depends on the One UI version; if it's missing, use one of the apps above |

Menu names change with each app's version. If you can't find it, search for "HTTP" or "URL" in the list of actions.

## Recipe 1: create a task with an HTTP request

1. In Questlist, create an automation with **When: Incoming call (webhook)** and **Then: Create task**. Pick the list and, in the title, write `{{hook.titulo}}`. Save and tap **Generate address**. Copy the address (it's shown only once).
2. In the automation app, create an HTTP request action:
   - **Method:** `POST`
   - **Address:** the one you copied
   - **Content type:** `application/json`
   - **Body:** `{"titulo": "Buy bread"}`
3. Run it. The answer is always `202`, with no body (even with a wrong address: Questlist doesn't tell whether it's valid). The task shows up in the chosen list; the automation's history shows each call.

Any field in the body becomes `{{hook.<name>}}` in the automation: `{"titulo": "...", "when": "tomorrow"}` gives `{{hook.titulo}}` and `{{hook.when}}`. A form body also works (`application/x-www-form-urlencoded`, `titulo=Buy bread`), which is the default in some apps. The body can be up to 16 KB and at most 4 levels deep.

**An idea:** in MacroDroid or Tasker, the trigger "SMS received from a given number" and the body `{"titulo": "Call back %SMSRF"}` (the sender variable, in Tasker). The app reads the SMS; Questlist only gets the title.

## Recipe 2: run an automation by opening the link

1. Create an automation with **When: Only when I run it** (for example, "Got home: open the Home list and start a pomodoro") and tap **Create link**. Copy the `https://…/r/…` address.
2. In the automation app, use the **open website** action (or **open URL**, **View content**, **Open URLs** in Shortcuts) with that address, and any trigger you like: joining the home Wi-Fi, dismissing the alarm, connecting to the car.
3. Questlist opens in the browser and runs the automation. If it asks for confirmation, tap **Run**. Turn off **Ask for confirmation when opened** to run it directly (an automation that calls a webhook or a device always asks).

The link only works for **your** signed-in account; on the phone it opens in the browser (not straight in the app yet).

## Be careful

- The incoming call address and the link work like passwords. When sharing an Automate flow, a Tasker profile or a shortcut, remove the address first. Leaked? Changing the address or **Replace link** stops the old one right away.
- There's a limit of calls per minute; above it, the answer is `429`. Don't use it for something that fires every second.
- To accept only your own calls, turn on **Require signature** in the automation and send the `X-Questlist-Signature` header with the body's HMAC (see **Automations**). Most of these apps can't compute an HMAC without a script; if yours can't, leave it off and keep the address safe.
- Health, location, camera and device data don't leave Questlist through a webhook unless you release them field by field; receiving data here doesn't change that.
