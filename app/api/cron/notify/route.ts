import { NextResponse } from "next/server";
import { loadData, updateData } from "@/lib/store";
import { itemsFor, localNow, toMin } from "@/lib/schedule";
import { pushReady, sendToAll } from "@/lib/push";
import { safeEqual } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Vercel Cron calls this every 5 minutes with "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  if (!pushReady()) return NextResponse.json({ ok: true, skipped: "push keys missing" });

  const data = await loadData();
  if (!data.subs.length) return NextResponse.json({ ok: true, skipped: "no devices" });

  const now = localNow();
  const lead = data.settings.leadMin ?? 10;
  // Anything starting from now up to the lead time plus the 5-minute gap between checks.
  const due = itemsFor(data, now.date, now.wd).filter((i) => {
    const s = toMin(i.start);
    return s >= now.minute && s <= now.minute + lead + 5 && !data.sent[i.key];
  });
  if (!due.length) return NextResponse.json({ ok: true, due: 0 });

  const dead = new Set<string>();
  for (const i of due) {
    const mins = toMin(i.start) - now.minute;
    const when = mins <= 0 ? "Starting now" : `In ${mins} min`;
    const r = await sendToAll(data.subs, { title: i.title, body: `${when} · ${i.start}–${i.end}`, tag: i.key });
    r.dead.forEach((e) => dead.add(e));
  }

  const weekAgo = Date.now() - 7 * 864e5;
  await updateData((d) => {
    due.forEach((i) => (d.sent[i.key] = Date.now()));
    for (const k of Object.keys(d.sent)) if (d.sent[k] < weekAgo) delete d.sent[k];
    if (dead.size) d.subs = d.subs.filter((s) => !dead.has(s.endpoint));
  });
  return NextResponse.json({ ok: true, due: due.length });
}
