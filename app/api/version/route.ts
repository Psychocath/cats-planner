import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The open app compares this with the version it loaded, and reloads itself when a new one is live.
export function GET() {
  return NextResponse.json({ version: (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev").slice(0, 12) });
}
