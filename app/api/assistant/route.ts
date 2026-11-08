import { NextResponse } from "next/server";
import { apply, propose } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { text } returns proposed changes; POST { apply: [...] } saves the ones Cat kept.
export async function POST(req: Request) {
  let body: { text?: unknown; apply?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 });
  }
  try {
    if (Array.isArray(body.apply)) {
      const results = await apply(body.apply as { name: string; args: Record<string, unknown> }[]);
      return NextResponse.json({ ok: results.every((r) => r.ok), results });
    }
    const text = String(body.text || "").trim().slice(0, 1000);
    if (!text) return NextResponse.json({ error: "Type what you'd like to change." }, { status: 400 });
    return NextResponse.json(await propose(text));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong. Try again." }, { status: 502 });
  }
}
