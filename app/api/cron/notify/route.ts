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
  // Up to 2 alerts per item: its main reminder (or the default) and an optional second one.
  const due = candidates.flatMap(({ i, offset }) =>
    [i.remind ?? lead, i.remind2]
      .map((remind, n) => ({ i, offset, remind, key: n ? `${i.key}|2` : i.key }))
      .filter(({ remind, key }) => {
        if (typeof remind !== "number" || remind < 0 || data.sent[key]) return false;
        const alertAt = offset + toMin(i.start) - remind;
        return alertAt <= now.minute + 2 && alertAt > now.minute - 10;
      }),
  );
  // Morning planning nudge: one alert a day at the chosen time, with a short summary.
  const mkey = `morning|${now.date}`;
  const mAt = data.settings.morning ? toMin(data.settings.morning) : -1;
  const morningDue = mAt >= 0 && !data.sent[mkey] && mAt <= now.minute + 2 && mAt > now.minute - 10;
  if (!due.length && !morningDue) return NextResponse.json({ ok: true, due: 0 });

  const dead = new Set<string>();
  for (const { i, offset, key } of due) {
    const mins = offset + toMin(i.start) - now.minute;
    const when = mins <= 0 ? "Starting now" : mins >= 1440 ? "Tomorrow" : mins >= 60 ? `In ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}` : `In ${mins} min`;
    const r = await sendToAll(data.subs, { title: i.title, body: `${when} · ${i.start}–${i.end}`, tag: key }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  if (morningDue) {
    const today = itemsFor(data, now.date, now.wd);
    const tops = data.tasks.filter((t) => t.priority === "top" && !t.done && t.date && String(t.date) <= now.date).length;
    const parts = [`${today.length} on the plan`, tops ? `${tops} top task${tops > 1 ? "s" : ""}` : "no Top 3 yet"];
    const r = await sendToAll(data.subs, { title: "Plan your day", body: parts.join(" · "), tag: mkey }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  const weekAgo = Date.now() - 7 * 864e5;
  await updateData((d) => {
    due.forEach(({ key }) => (d.sent[key] = Date.now()));
    if (morningDue) d.sent[mkey] = Date.now();
    for (const k of Object.keys(d.sent)) if (d.sent[k] < weekAgo) delete d.sent[k];
    if (dead.size) d.subs = d.subs.filter((s) => !dead.has(s.endpoint));
  });
  return NextResponse.json({ ok: true, due: due.length });
}
