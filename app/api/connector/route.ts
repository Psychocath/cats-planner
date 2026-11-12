import { NextResponse } from "next/server";
import { updateData } from "@/lib/store";

export const dynamic = "force-dynamic";
// A stuck request ends after 30 seconds instead of Vercel's default of 300.
export const maxDuration = 30;

function randomKey() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// POST {action:"create"} makes a new key (replacing any old one); {action:"revoke"} turns it off.
export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({}));
  const origin = new URL(req.url).origin;
  if (action === "create") {
    const key = await updateData((d) => (d.claudeKey = randomKey()));
    return NextResponse.json({ ok: true, url: `${origin}/api/mcp/${key}` });
  }
  if (action === "revoke") {
    await updateData((d) => void delete d.claudeKey);
    return NextResponse.json({ ok: true, url: null });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
