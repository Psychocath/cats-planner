import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in again to keep planning." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login screen, the cron sender, and files the phone needs before sign-in.
  matcher: ["/((?!login|api/login|api/cron|_next|sw.js|manifest.webmanifest|icons|favicon.ico|planner.js).*)"],
};
