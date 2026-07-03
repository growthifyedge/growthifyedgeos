# WhatsApp Auto-Responder — Full Setup Guide (from scratch)

This guide takes you from **nothing** to a working WhatsApp auto-responder wired
into GrowthifyEdgeOS. When a customer sends a WhatsApp message, Meta pushes it to
your app, your app stores it and replies automatically.

> **This app has been simplified to a single purpose: WhatsApp.** The old agency
> features (agents, attendance, tasks, KPIs, payroll) are retired — visiting
> `/admin` or `/agent` now redirects to the home page. The home page (`/`) is a
> **WhatsApp inbox** showing every conversation and every auto-reply. (The old
> page files still exist on disk but are unreachable; you can delete the
> `app/admin` and `app/agent` folders anytime.)

**Cost:** Free for this use case. Customers message you first, and you reply
inside the 24-hour window → these are "service conversations", which are free
(plus 1,000 free/month on top). You only pay if *you* start conversations with
marketing/template messages.

**Time:** ~30–45 minutes the first time.

---

## Part 0 — Understand the "number" question (read this first)

There are **two different WhatsApp things**, and they cannot share a number:

| | WhatsApp Business **App** (on your phone) | WhatsApp **Cloud API** (what we need) |
|---|---|---|
| Where it runs | Your phone | Meta's servers, talks to your software |
| Auto-reply to your software? | ❌ No — it can't forward to code | ✅ Yes — that's the whole point |
| Number | Your normal business number | A number **dedicated** to the API |

**Key rule:** A phone number can be active on the app **or** on the Cloud API, **not both**.

So you have two options for the number:

- **Option A (recommended to start): use Meta's free TEST number.** Meta gives you
  a free test phone number the moment you set up the app. It can send to up to 5
  numbers you verify (e.g. your own phone). Perfect for building & testing —
  **no need to touch your real number yet.**
- **Option B (going live): use a real number** that is NOT currently on WhatsApp.
  Either buy a fresh SIM/number, or if you want to reuse your current business
  number you must first **delete its WhatsApp account** in the app, then register
  it on the Cloud API.

👉 We'll build and test everything on the **test number** first, then switch to a
real number at the end.

---

## Part 1 — Create the Meta accounts (free)

1. Go to **https://developers.facebook.com/** and click **Log in** (use your
   Facebook account; create one if needed).
2. Click **My Apps** → **Create App**.
3. When asked "What do you want your app to do?", choose **Other** → **Next**.
4. App type: choose **Business** → **Next**.
5. Give it a name (e.g. `Growthify WhatsApp`), enter your email, and pick or
   create a **Meta Business Account** (a.k.a. Business Portfolio). Click **Create app**.

You now have a Meta app. 🎉

---

## Part 2 — Add the WhatsApp product

1. Inside your new app's dashboard, scroll to **Add products to your app**.
2. Find **WhatsApp** → click **Set up**.
3. It may ask you to select/create a **Business Portfolio** — pick the one from Part 1.
4. You'll land on **WhatsApp → API Setup**. This page has everything you need:
   - A **test phone number** ("From" number) with its **Phone number ID**.
   - A **temporary access token** (valid 24h).
   - A box to add **recipient** numbers (add your own phone here to test).

Keep this tab open — you'll copy values from it.

---

## Part 3 — Collect your credentials

From **WhatsApp → API Setup**, copy these into a notepad:

| Value on the page | Goes into env var |
|---|---|
| **Phone number ID** | `WHATSAPP_PHONE_NUMBER_ID` |
| **Temporary access token** | `WHATSAPP_ACCESS_TOKEN` (temporary for now) |

Also **invent a random secret string** for `WHATSAPP_VERIFY_TOKEN` — anything long,
e.g. `growthify_wh_9x7Kq2vLpZ`. You'll use it in Part 6.

> ⚠️ The temporary token dies after 24h. That's fine for testing. Part 8 shows how
> to create a **permanent** token before going live.

---

## Part 4 — Put the credentials into the app

Open your project's `.env.local` (create it by copying `.env.local.example` if it
doesn't exist) and fill in:

```env
WHATSAPP_VERIFY_TOKEN=growthify_wh_9x7Kq2vLpZ
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAG...your-temp-token...

# Protects the inbox dashboard at "/" (browser username+password popup).
# Leave DASHBOARD_PASSWORD blank to leave the dashboard open.
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=choose-a-strong-password
```

(Your Supabase vars should already be set from the main README.)

> **Deploying on Vercel?** Put ALL of these (the WhatsApp ones + the two
> DASHBOARD ones) into Vercel → Settings → Environment Variables, then Redeploy.
> `.env.local` is only for running locally.

---

## Part 5 — Run the database migration

The webhook stores messages in two new tables. Apply the migration:

- **Easiest:** open Supabase → **SQL Editor**, paste the contents of
  `supabase/migrations/0007_whatsapp.sql`, and click **Run**.
- **Or CLI:** `supabase db push`

This creates `whatsapp_contacts` and `whatsapp_messages`.

---

## Part 6 — Expose your app + connect the webhook

Meta needs a **public HTTPS URL** to reach your `/api/whatsapp` route. Two paths:

### 6a. Testing locally (fastest)

1. Start the app: `npm run dev` (runs on http://localhost:3000).
2. In a second terminal, expose it with a tunnel. Install ngrok
   (https://ngrok.com, free) and run:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL it prints, e.g. `https://ab12cd34.ngrok-free.app`.
   Your webhook URL is that + `/api/whatsapp`:
   ```
   https://ab12cd34.ngrok-free.app/api/whatsapp
   ```

### 6b. Production (permanent)

Deploy to **Vercel** (your README already targets it): import the repo, add ALL
env vars (Supabase + the three WhatsApp ones) in Vercel → Settings → Environment
Variables, deploy. Your webhook URL is:
```
https://your-app.vercel.app/api/whatsapp
```

### Connect it in Meta

1. In the Meta app dashboard: **WhatsApp → Configuration** (or **API Setup →
   Webhooks**).
2. Click **Edit** next to Webhook.
3. **Callback URL:** paste your webhook URL (from 6a or 6b).
4. **Verify token:** paste the SAME string you set as `WHATSAPP_VERIFY_TOKEN`.
5. Click **Verify and save**. ✅ If it turns green, the handshake worked
   (that's the `GET` half of `app/api/whatsapp/route.ts`).
6. Still on Configuration, under **Webhook fields**, click **Manage** and
   **Subscribe** to **`messages`**. (This is essential — without it, Meta won't
   send you incoming messages.)

---

## Part 7 — Test it

1. In **API Setup**, make sure your own phone number is added as an allowed
   **recipient** (test numbers can only talk to verified recipients).
2. From your personal WhatsApp, send a message ("hi") to the **test number**
   shown in API Setup.
3. You should get an **automatic reply** within a second or two. 🎉
4. Check Supabase → Table Editor → `whatsapp_messages`: you'll see both the
   inbound message and the outbound reply logged.

If nothing comes back, see **Troubleshooting** below.

---

## Part 8 — Make the access token permanent (before going live)

The temporary token expires in 24h. Create a never-expiring one:

1. Go to **https://business.facebook.com/settings/** (Meta Business Settings).
2. **Users → System Users → Add** → create one (role: **Admin**).
3. Click **Add Assets** → assign your **WhatsApp app** (or WABA) with full control.
4. Click **Generate new token** → select your app → tick the permissions
   **`whatsapp_business_messaging`** and **`whatsapp_business_management`**.
5. Copy the generated token (shown once). Put it in `WHATSAPP_ACCESS_TOKEN`
   (in `.env.local` locally and in Vercel for production). Redeploy.

---

## Part 9 — Go live with a real number

When you're ready to use a real customer-facing number instead of the test one:

1. In **WhatsApp → API Setup**, click **Add phone number**.
2. Enter a number that is **NOT currently on WhatsApp** (see Part 0). Choose SMS
   or call verification and enter the code.
3. Complete **Meta Business Verification** (Business Settings → Security Center) —
   Meta asks for business documents; required to send at scale.
4. Copy the **new** Phone number ID into `WHATSAPP_PHONE_NUMBER_ID` and redeploy.
5. Remove the messaging limits by verifying your business and adding a payment
   method (you still won't be charged for free service conversations, but Meta
   requires a card on file to lift limits).

---

## Where to change what the bot says

All auto-reply wording and logic lives in **`lib/whatsapp/reply.ts`** — edit the
`buildAutoReply()` function. Right now it does simple keyword matching (greetings,
"price", "hours", etc.) with a default fallback. Replace it with your own logic,
database lookups, or return `null` to send no reply.

---

## Files added to the project

| File | Purpose |
|---|---|
| `app/api/whatsapp/route.ts` | The webhook: verifies (GET), receives messages (POST), stores them, triggers the reply. |
| `lib/whatsapp/send.ts` | Sends text & template messages via the Graph API. |
| `lib/whatsapp/reply.ts` | **Your customizable auto-reply brain.** |
| `supabase/migrations/0007_whatsapp.sql` | `whatsapp_contacts` + `whatsapp_messages` tables. |
| `.env.local.example` | Documents the three new env vars. |

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Verify and save" fails (red) | `WHATSAPP_VERIFY_TOKEN` in the app ≠ the token typed in Meta, or the URL is wrong / app not running. Confirm the URL ends in `/api/whatsapp` and the app is reachable. |
| Verified, but no auto-reply | You didn't **Subscribe to `messages`** in Webhook fields (Part 6, step 6). |
| No reply + error in logs | Token expired (make it permanent, Part 8), or recipient not in the allowed test list (Part 7, step 1). |
| Reply works but message says "outside 24h window" | You're messaging first / too late. Free-form text only works within 24h of the customer's last message; otherwise use `sendWhatsAppTemplate()`. |
| Duplicate replies | Meta retried before we ACKed. The route dedupes by `wa_message_id`, so ensure migration 0007 ran (the `wa_message_id` unique column). |

---

## Quick mental model

```
Customer's WhatsApp
        │  (sends "hi")
        ▼
   Meta servers  ──POST──►  https://your-app/api/whatsapp   (your Next.js route)
                                   │  1. store inbound msg (Supabase)
                                   │  2. buildAutoReply() decides text
                                   │  3. POST to Graph API  ──► Meta ──► Customer
                                   ▼
                             store outbound msg (Supabase)
```

That's the entire system. Build on the test number, flip to a real number when ready.
