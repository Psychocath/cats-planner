import { NextResponse } from "next/server";
import { apply, propose, readBill } from "@/lib/assistant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { text } returns proposed changes; POST { apply: [...] } saves the ones Cat kept.
// POST { bill: text, image? } reads a payment message into bill fields. Nothing is saved.
export async function POST(req: Request) {
  let body: { text?: unknown; apply?: unknown; bill?: unknown; image?: { mime?: unknown; data?: unknown } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 });
  }
  try {
    if (body.bill !== undefined || body.image) {
      const text = String(body.bill || "").trim().slice(0, 4000);
      const mime = String(body.image?.mime || ""), data = String(body.image?.data || "");
      const image = data && /^image\/(png|jpeg|webp|heic|heif)$/.test(mime) && data.length < 4_000_000 ? { mime, data } : undefined;
      if (!text && !image) return NextResponse.json({ error: "Paste the message or add a screenshot first." }, { status: 400 });
      return NextResponse.json({ bill: await readBill(text, image) });
    }
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
