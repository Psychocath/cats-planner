# Cat's Planner

A personal day planner: time blocks, a Top 3, a weekly view, tasks and repeating routines, with phone alerts before each block.

## How it works
- **Next.js app** on Vercel. The planner screen is `public/planner.js`; the API is in `app/api`.
- **Login:** one password (`APP_PASSWORD`). Sessions last 180 days.
- **Data:** one private JSON file in Vercel Blob (`planner/data.json`). Locally, without a Blob token, it saves to `.localdata.json`.
- **Alerts:** web push. A scheduler calls `/api/cron/notify?key=<CRON_SECRET>` every 5 minutes (cron-job.org on the Hobby plan; on Pro, add a Vercel cron in `vercel.json`) and alerts each device before blocks and routines start. On iPhone, add the app to your Home Screen first, then turn alerts on in Settings.

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
