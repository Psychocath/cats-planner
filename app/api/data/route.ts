import { NextResponse } from "next/server";
import { COLLECTIONS, Collection, updateData } from "@/lib/store";
import { getKeys } from "@/lib/push";
import { loadRolled, rebalance } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const d = await loadRolled();
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    tasks: d.tasks,
    blocks: d.blocks,
    routines: d.routines,
    slots: d.slots,
    settings: d.settings,
    connectorUrl: d.claudeKey ? `${origin}/api/mcp/${d.claudeKey}` : null,
    alerts: { devices: d.subs.length, lastCheck: d.lastCheck ?? null, publicKey: (await getKeys(d)).publicKey },
  });
}

const TIME = /^\d{2}:\d{2}$/;

export async function POST(req: Request) {
  let body: { op?: string; col?: string; id?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 });
  }
  const { op, col, id, data } = body;

  if (op === "settings") {
    const s = data || {};
    if ((s.workStart && !TIME.test(String(s.workStart))) || (s.workEnd && !TIME.test(String(s.workEnd)))) {
      return NextResponse.json({ error: "Use times like 09:00." }, { status: 400 });
    }
    const settings = await updateData((d) => {
      if (s.workStart) d.settings.workStart = String(s.workStart);
      if (s.workEnd) d.settings.workEnd = String(s.workEnd);
      if (s.palette !== undefined && ["rainbow", "calm", "ocean", "blossom", "collective"].includes(String(s.palette))) d.settings.palette = String(s.palette);
      if (s.morning !== undefined) d.settings.morning = s.morning && s.morning !== "off" && TIME.test(String(s.morning)) ? String(s.morning) : null;
      if (s.leadMin !== undefined) d.settings.leadMin = Math.max(0, Math.min(60, Number(s.leadMin) || 0));
      return d.settings;
    });
    return NextResponse.json({ ok: true, settings });
  }

  // After an appointment or sized task changes a day, move overflow to the next session with room.
  if (op === "rebalance") {
    const date = String(data?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Use dates like 2026-11-12." }, { status: 400 });
    const moved = await updateData((d) => rebalance(d, date));
    return NextResponse.json({ ok: true, moved });
  }

  if (!COLLECTIONS.includes(col as Collection) || !id || !/^[\w-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "That item couldn't be found." }, { status: 400 });
  }
  const c = col as Collection;

  if (op === "set") {
    if (!data || typeof data !== "object") return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    await updateData((d) => {
      const rec = { ...data, id };
      const i = d[c].findIndex((x) => x.id === id);
      if (i >= 0) d[c][i] = rec;
      else d[c].push(rec);
    });
    return NextResponse.json({ ok: true });
  }
  if (op === "delete") {
    await updateData((d) => {
      d[c] = d[c].filter((x) => x.id !== id);
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
