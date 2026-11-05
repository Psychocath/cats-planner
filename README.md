# Cat's Planner

A personal day planner: time blocks, a Top 3, a weekly view, tasks and repeating routines, with phone alerts before each block.

## How it works
- **Next.js app** on Vercel. The planner screen is `public/planner.js`; the API is in `app/api`.
- **Login:** one password (`APP_PASSWORD`). Sessions last 180 days.
- **Data:** one private JSON file in Vercel Blob (`planner/data.json`). Locally, without a Blob token, it saves to `.localdata.json`.
- **Alerts:** web push. Vercel Cron calls `/api/cron/notify` every 5 minutes and alerts each device before blocks and routines start. On iPhone, add the app to your Home Screen first, then turn alerts on in Settings.

## Environment variables
See `.env.example`. Generate push keys with `npm run vapid`.

## Run locally
```
npm install
cp .env.example .env.local   # fill in APP_PASSWORD and SESSION_SECRET
npm run dev
```
