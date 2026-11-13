import { NextResponse } from "next/server";
import { dailyBackup, updateData } from "@/lib/store";
import { itemsFor, localNow, shiftDate, toMin } from "@/lib/schedule";
import { sendToAll } from "@/lib/push";
import { safeEqual } from "@/lib/auth";
import { loadRolled } from "@/lib/slots";

export const dynamic = "force-dynamic";
// A stuck request ends after 60 seconds instead of Vercel's default of 300.
export const maxDuration = 60;

// Called every few minutes by a scheduler (Vercel Cron on Pro, or cron-job.org on Hobby).
export async function GET(req: Request) {
  // With CRON_SECRET set, only Vercel Cron (which sends it) gets in. Without it, accept Vercel Cron's user agent;
  // the route only sends alerts that are due anyway and never returns planner data.
  // An outside scheduler (cron-job.org) may pass the secret as ?key= since some can't set headers.
  // Tolerant matching: trims stray spaces from the saved value and the link, and treats a "+"
  // that a browser turned into a space as the same thing, so a typed secret still matches.
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = (req.headers.get("authorization") || "").trim();
  const rawKey = /[?&]key=([^&]*)/.exec(req.url)?.[1] || "";
  let decoded = rawKey;
  try {
    decoded = decodeURIComponent(rawKey);
  } catch {}
  const keys = [decoded, decoded.replace(/ /g, "+"), rawKey].map((k) => k.trim());
  const allowed = secret
    ? safeEqual(auth, `Bearer ${secret}`) || keys.some((k) => k && safeEqual(k, secret))
    : (req.headers.get("user-agent") || "").startsWith("vercel-cron/");
  if (!allowed) {
    const reason = !rawKey && !auth ? "The link has no ?key= on the end." : "The key in the link doesn't match CRON_SECRET in Vercel.";
    return NextResponse.json({ error: "Not allowed.", reason }, { status: 401 });
  }

  // Moves yesterday's unticked tasks to today's first session overnight, before any alert goes out.
  const data = await loadRolled();
  // Once a day, keep a full copy of the planner (the last 14 days are kept).
  await dailyBackup(localNow().date);
  // Record that a check ran, so the app can warn when the scheduler stops. Saved at most every
  // 30 minutes to keep Blob writes low; the app warns after 45 minutes without a check.
  const staleCheck = !data.lastCheck || Date.now() - data.lastCheck > 30 * 60000;
  if (!data.subs.length) {
    if (staleCheck) await updateData((d) => { d.lastCheck = Date.now(); });
    return NextResponse.json({ ok: true, skipped: "no devices" });
  }

  const now = localNow();
  const lead = data.settings.leadMin ?? 10;
  // Each item alerts at its own reminder (or the default). Look at today and tomorrow so
  // "1 day before" works, and send anything whose alert time fell in the last 10 minutes
  // or lands in the next 2, since the scheduler only calls every 5 minutes.
  // Look 8 days ahead so "1 day" and "2 days before" style reminders fire on time.
  const candidates = Array.from({ length: 8 }, (_, d) => {
    const day = d ? shiftDate(now.date, d) : { date: now.date, wd: now.wd };
    return itemsFor(data, day.date, day.wd, true).map((i) => ({ i, offset: d * 1440, date: day.date, wd: day.wd }));
  }).flat();
  // Up to 2 alerts per item: its main reminder (or the default) and an optional second one.
  const due = candidates.flatMap((c) => { const { i, offset } = c; return (
    [i.remind ?? lead, i.remind2]
      .map((remind, n) => ({ i, offset, date: c.date, wd: c.wd, remind, key: n ? `${i.key}|2` : i.key }))
      .filter(({ remind, key }) => {
        if (typeof remind !== "number" || remind < 0 || data.sent[key]) return false;
        const alertAt = offset + toMin(i.start) - remind;
        return alertAt <= now.minute + 2 && alertAt > now.minute - 10;
      }));
  });
  // Morning planning nudge: one alert a day at the chosen time, with a short summary.
  const mkey = `morning|${now.date}`;
  const mAt = data.settings.morning ? toMin(data.settings.morning) : -1;
  const morningDue = mAt >= 0 && !data.sent[mkey] && mAt <= now.minute + 2 && mAt > now.minute - 10;
  // End of the work day, Monday to Friday: one nudge to tick what got done, if anything is still open.
  const wkey = `wrap|${now.date}`;
  const wAt = toMin(data.settings.workEnd);
  const openNow = data.tasks.filter((t) => !t.done && !t.ai && !t.waiting && t.date && String(t.date) <= now.date && !/\bshopping\s*$/i.test(String(t.title || ""))).length;
  const wrapDue = now.wd <= 5 && openNow > 0 && !data.sent[wkey] && wAt <= now.minute + 2 && wAt > now.minute - 10;
  // Bills: one alert at 08:00, 7 days before payday, on payday, and on any day a bill is overdue.
  const bills = billAlert(data.bills || [], now.date);
  const bAt = 8 * 60;
  const billDue = !!bills && !data.sent[bills.key] && bAt <= now.minute + 2 && bAt > now.minute - 10;
  if (!due.length && !morningDue && !wrapDue && !billDue) {
    if (staleCheck) await updateData((d) => { d.lastCheck = Date.now(); });
    return NextResponse.json({ ok: true, due: 0 });
  }

  const dead = new Set<string>();
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (const { i, offset, date, wd, key } of due) {
    const mins = offset + toMin(i.start) - now.minute;
    const [, mo, dd] = date.split("-").map(Number);
    const dayName = `${DAYS[wd - 1]} ${dd} ${MONS[mo - 1]}`;
    const span = `${i.start}–${i.end}`;
    let body: string;
    if (offset === 0) {
      const inTxt = mins <= 0 ? "Starting now" : mins >= 60 ? `In ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}` : `In ${mins} min`;
      body = `${inTxt} · today ${span}`;
    } else {
      const rel = offset === 1440 ? "Tomorrow" : `In ${offset / 1440} days`;
      body = `Due ${rel}, ${dayName} · ${span}`;
    }
    const r = await sendToAll(data.subs, { title: i.title, body, tag: key }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  if (morningDue) {
    const today = itemsFor(data, now.date, now.wd);
    const tops = data.tasks.filter((t) => t.priority === "top" && !t.done && t.date && String(t.date) <= now.date).length;
    const moved = data.tasks.filter((t) => !t.done && t.carries && t.date === now.date && t.from && String(t.from) < now.date).length;
    const parts = [`${today.length} on the plan`, tops ? `${tops} top task${tops > 1 ? "s" : ""}` : "no Top 3 yet"];
    if (moved) parts.push(`${moved} task${moved > 1 ? "s" : ""} moved from last work day`);
    const r = await sendToAll(data.subs, { title: "Plan your day", body: parts.join(" · "), tag: mkey }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  if (wrapDue) {
    const r = await sendToAll(data.subs, { title: "Wrap up your day", body: `${openNow} task${openNow > 1 ? "s" : ""} still open. Tick what you finished; the rest moves on overnight.`, tag: wkey }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  if (billDue && bills) {
    const r = await sendToAll(data.subs, { title: bills.title, body: bills.body, tag: bills.key }, data);
    r.dead.forEach((e) => dead.add(e));
  }

  const weekAgo = Date.now() - 7 * 864e5;
  await updateData((d) => {
    d.lastCheck = Date.now();
    due.forEach(({ key }) => (d.sent[key] = Date.now()));
    if (morningDue) d.sent[mkey] = Date.now();
    if (wrapDue) d.sent[wkey] = Date.now();
    if (billDue && bills) d.sent[bills.key] = Date.now();
    for (const k of Object.keys(d.sent)) if (d.sent[k] < weekAgo) delete d.sent[k];
    if (dead.size) d.subs = d.subs.filter((s) => !dead.has(s.endpoint));
  });
  return NextResponse.json({ ok: true, due: due.length });
}

/* Payday is the 29th, or the last day of a shorter month (28 Feb). A bill set to "payday" carries that date as its due date. */
const ymdUTC = (d: Date) => d.toISOString().slice(0, 10);
function paydayOn(y: number, m: number) {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return ymdUTC(new Date(Date.UTC(y, m, Math.min(29, last))));
}
function nextPayday(today: string) {
  const [y, m] = today.split("-").map(Number);
  const p = paydayOn(y, m - 1);
  return p >= today ? p : paydayOn(y, m);
}
const rand = (n: number) => "R" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function billAlert(bills: Record<string, unknown>[], today: string) {
  const open = bills.filter((b) => !b.paid && b.due);
  const total = (l: Record<string, unknown>[]) => rand(l.reduce((a, b) => a + (Number(b.amount) || 0), 0));
  const late = open.filter((b) => String(b.due) < today);
  if (late.length) return { key: `bills|late|${today}`, title: late.length === 1 ? "A bill is overdue" : `${late.length} bills are overdue`, body: `${late.map((b) => b.payee).slice(0, 3).join(", ")} · ${total(late)} to pay` };
  const pd = nextPayday(today);
  const byPd = open.filter((b) => String(b.due) <= pd);
  if (!byPd.length) return null;
  if (pd === today) return { key: `bills|pay|${today}`, title: "Payday: bills to pay today", body: `${byPd.length} bill${byPd.length > 1 ? "s" : ""} · ${total(byPd)}. Open Bills to copy the details.` };
  const days = Math.round((Date.parse(pd) - Date.parse(today)) / 864e5);
  if (days === 7) return { key: `bills|week|${pd}`, title: "Due before payday", body: `${byPd.length} bill${byPd.length > 1 ? "s" : ""} · ${total(byPd)} on the ${Number(pd.slice(8))}th` };
  return null;
}
