import { NextResponse } from "next/server";
import { loadData } from "@/lib/store";
import { safeEqual } from "@/lib/auth";
import { handleRpc } from "@/lib/mcp";

export const dynamic = "force-dynamic";

async function keyOk(key: string) {
  const d = await loadData();
  return !!d.claudeKey && safeEqual(key, d.claudeKey);
}

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!(await keyOk(key))) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "This Claude key is off or was replaced. Make a new one in the planner's Settings." } }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const msgs = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(msgs.map((m) => handleRpc(m)))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0]);
}

// No server-initiated stream; clients fall back to plain request/response.
export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
export async function DELETE() {
  return new Response(null, { status: 204 });
}
