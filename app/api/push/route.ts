import { NextResponse } from "next/server";
import { loadData, updateData, type PushSub } from "@/lib/store";
import { pushReady, sendToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST {action:"subscribe", subscription} | {action:"unsubscribe", endpoint} | {action:"test"}
export async function POST(req: Request) {
  if (!pushReady()) return NextResponse.json({ error: "Alerts aren't set up on the server yet." }, { status: 500 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "subscribe") {
    const s = body.subscription as PushSub | undefined;
    if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) {
      return NextResponse.json({ error: "This device didn't share what alerts need." }, { status: 400 });
    }
    const devices = await updateData((d) => {
      d.subs = d.subs.filter((x) => x.endpoint !== s.endpoint);
      d.subs.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, addedAt: Date.now() });
      return d.subs.length;
    });
    return NextResponse.json({ ok: true, devices });
  }

  if (body.action === "unsubscribe") {
    const devices = await updateData((d) => {
      d.subs = d.subs.filter((x) => x.endpoint !== body.endpoint);
      return d.subs.length;
    });
    return NextResponse.json({ ok: true, devices });
  }

  if (body.action === "test") {
    const d = await loadData();
    if (!d.subs.length) return NextResponse.json({ error: "No devices have alerts on yet." }, { status: 400 });
    const { sent, dead } = await sendToAll(d.subs, { title: "Alerts are on", body: "You'll get a nudge before each block.", tag: "test" });
    if (dead.length) await updateData((x) => void (x.subs = x.subs.filter((s) => !dead.includes(s.endpoint))));
    return NextResponse.json({ ok: true, sent });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
