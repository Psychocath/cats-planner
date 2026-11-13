# Cat's Planner

A personal day planner: time blocks, a Top 3, a weekly view, tasks and repeating routines, with phone alerts before each block.

## How it works
- **Next.js app** on Vercel. The planner screen is `public/planner.js`; the API is in `app/api`.
- **Login:** one password (`APP_PASSWORD`). Sessions last 180 days.
- **Data:** Supabase Postgres when `POSTGRES_URL` is set: tables `planner_items` (one row per task, event, routine and slot) and `planner_kv` (settings and alert state), created on first start and locked with row level security. The first start copies the old Blob file (`planner/data.json`) across once and leaves it in place. A full copy is saved to Blob once a day (`planner/backups/`, last 14 kept). Without `POSTGRES_URL`, or with `PLANNER_STORE=blob`, the planner uses the Blob file; locally without a Blob token it saves to `.localdata.json`.
- **Alerts:** web push. A scheduler calls `/api/cron/notify?key=<CRON_SECRET>` every 5 minutes (cron-job.org on the Hobby plan; on Pro, add a Vercel cron in `vercel.json`) and alerts each device before blocks and routines start. On iPhone, add the app to your Home Screen first, then turn alerts on in Settings.

## Bills
Bills live in the Personal hub, with the total still to pay before payday (the 29th, or the last day of a shorter month). Paste an SMS, email or screenshot into "Paste a bill" (or Quick Add) and Gemini fills in the card; nothing saves until Cat checks it. Every value she pastes into her banking app has a copy button, plus Copy all. A new payee, or banking details that differ from the saved ones, must be ticked as checked against an invoice before the card saves. Monthly bills make next month's bill when marked paid. Home shows "Due before payday" in the last 7 days, "Pay today" on payday, and overdue bills and proof-of-payment reminders any day. The alert check sends a bill alert at 08:00 on those days. Bills sit behind the login like the rest of the planner and aren't shared with the Claude connector.

## Claude connector
Settings → Claude connector makes a private MCP link (`/api/mcp/<key>`). Add it in Claude as a custom connector to read and update the planner from chat. "Make a new link" replaces the key; "Turn off" removes it.

## Environment variables
Only `APP_PASSWORD` is required; see `.env.example` for the optional ones. The app makes its own push keys on first run.

## Run locally
```
npm install
cp .env.example .env.local   # fill in APP_PASSWORD and SESSION_SECRET
npm run dev
```
