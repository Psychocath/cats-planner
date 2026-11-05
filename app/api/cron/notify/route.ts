import { NextResponse } from "next/server";
import { loadData, updateData } from "@/lib/store";
import { itemsFor, localNow, shiftDate, toMin } from "@/lib/schedule";
import { sendToAll } from "@/lib/push";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Called every few minutes by a scheduler (Vercel Cron on Pro, or cron-job.org on Hobby).
export async function GET(req: Request) {
  // With CRON_SECRET set, only Vercel Cron (which sends it) gets in. Without it, accept Vercel Cron's user agent;
  // the route only sends alerts that are due anyway and never returns planner data.
  // An outside scheduler (cron-job.org) may pass the secret as ?key= since some can't set headers.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  const allowed = secret
    ? safeEqual(auth, `Bearer ${secret}`) || safeEqual(key, secret)
    : (req.headers.get("user-agent") || "").startsWith("vercel-cron/");
  if (!allowed) return NextResponse.json({ error: "Not allowed." }, { status: 401 });

  const data = await loadData();
  if (!data.subs.length) return NextResponse.json({ ok: true, skipped: "no devices" });

  const now = localNow();
  const lead = data.settings.leadMin ?? 10;
  // Each item alerts at its own reminder (or the default). Look at today and tomorrow so
  // "1 day before" works, and send anything whose alert time fell in the last 10 minutes
  // or lands in the next 2, since the scheduler only calls every 5 minutes.
  const tomorrow = shiftDate(now.date, 1);
  const candidates = [
    ...itemsFor(data, now.date, now.wd).map((i) => ({ i, offset: 0 })),
    ...itemsFor(data, tomorrow.date, tomorrow.wd).map((i) => ({ i, offset: 1440 })),
  ];
  const due = candidates.filter(({ i, offset }) => {
    const remind = i.remind ?? lead;
    if (remind < 0 || data.sent[i.key]) return false;
    const alertAt = offset + toMin(i.start) - remind;
    return alertAt <= now.minute + 2 && alertAt > now.minute - 10;
  });
  if (!due.length) return NextResponse.json({ ok: true, due: 0 });

  const dead = new Set<string>();
  for (const { i, offset } of due) {
    const mins = offset + toMin(i.start) - now.minute;
    const when = mins <= 0 ? "Starting now" : mins >= 1440 ? "Tomorrow" : mins >= 60 ? `In ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}` : `In ${mins} min`;
    const r = await sendToAll(data.subs, { title: i.title, body: `${when} · ${i.start}–${i.end}`, tag: i.key }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  const weekAgo = Date.now() - 7 * 864e5;
  await updateData((d) => {
    due.forEach(({ i }) => (d.sent[i.key] = Date.now()));
    for (const k of Object.keys(d.sent)) if (d.sent[k] < weekAgo) delete d.sent[k];
    if (dead.size) d.subs = d.subs.filter((s) => !dead.has(s.endpoint));
  });
  return NextResponse.json({ ok: true, due: due.length });
}
