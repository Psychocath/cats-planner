import { NextResponse } from "next/server";
import { storeInfo } from "@/lib/store";

export const dynamic = "force-dynamic";
// A stuck request ends after 30 seconds instead of Vercel's default of 300.
export const maxDuration = 30;

// Signed-in only (the middleware covers it): says where the planner's data is kept and how many records are there.
export async function GET() {
  try {
    return NextResponse.json(await storeInfo());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't check the store." }, { status: 502 });
  }
}
