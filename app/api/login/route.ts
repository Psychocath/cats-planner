import { NextResponse } from "next/server";
import { COOKIE, MAX_AGE, createSession, safeEqual } from "@/lib/auth";
import { loadData, updateData } from "@/lib/store";

// After 5 wrong passwords in 15 minutes, sign-in locks for 15 minutes. Devices already signed in stay signed in.
const MAX_FAILS = 5;
const WINDOW = 15 * 60000;
const LOCK = 15 * 60000;

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ error: "The app has no password set yet." }, { status: 500 });
  let password = "";
  try {
    password = String((await req.json()).password || "");
  } catch {}

  // If the store can't be reached, the password check still runs; only the attempt count is skipped.
  const state = await loadData().then((d) => d.login).catch(() => undefined);
  const now = Date.now();
  if (state?.lockedUntil && state.lockedUntil > now) {
    const mins = Math.ceil((state.lockedUntil - now) / 60000);
    return NextResponse.json({ error: `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` }, { status: 429 });
  }

  if (!safeEqual(password, expected)) {
    const left = await updateData((d) => {
      const fails = [...(d.login?.fails || []).filter((t) => now - t < WINDOW), now];
      d.login = fails.length >= MAX_FAILS ? { fails: [], lockedUntil: now + LOCK } : { fails };
      return MAX_FAILS - fails.length;
    }).catch(() => MAX_FAILS - 1);
    await new Promise((r) => setTimeout(r, 700));
    if (left <= 0) return NextResponse.json({ error: "Too many wrong passwords. Try again in 15 minutes." }, { status: 429 });
    return NextResponse.json({ error: `That password isn't right. ${left} ${left === 1 ? "try" : "tries"} left before a 15 minute pause.` }, { status: 401 });
  }

  if (state?.fails?.length || state?.lockedUntil) await updateData((d) => void delete d.login).catch(() => undefined);
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
