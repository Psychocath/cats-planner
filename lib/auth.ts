// Signed session cookie using Web Crypto, so it runs in middleware and route handlers alike.
export const COOKIE = "cp_session";
export const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

const enc = new TextEncoder();

async function hmac(value: string): Promise<string> {
  // Changing APP_PASSWORD signs every device out, which is what you want after a password change.
  const secret = process.env.SESSION_SECRET || (process.env.APP_PASSWORD ? `cats-planner:${process.env.APP_PASSWORD}` : "");
  if (!secret) throw new Error("APP_PASSWORD is not set");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(): Promise<string> {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  try {
    return safeEqual(sig, await hmac(exp));
  } catch {
    return false;
  }
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
