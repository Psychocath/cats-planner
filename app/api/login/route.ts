import { NextResponse } from "next/server";
import { COOKIE, MAX_AGE, createSession, safeEqual } from "@/lib/auth";

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ error: "The app has no password set yet." }, { status: 500 });
  let password = "";
  try {
    password = String((await req.json()).password || "");
  } catch {}
  if (!safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: "That password isn't right. Try again." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
