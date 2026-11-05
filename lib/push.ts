import webpush from "web-push";
import { loadData, updateData, type Data, type PushSub } from "./store";

type Keys = { publicKey: string; privateKey: string };

/** Push keys come from env vars if set; otherwise the app makes a pair once and keeps it in its private data file. */
export async function getKeys(existing?: Data): Promise<Keys> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const d = existing || (await loadData());
  if (d.vapid) return d.vapid;
  return updateData((x) => {
    if (!x.vapid) x.vapid = webpush.generateVAPIDKeys();
    return x.vapid;
  });
}

/** Sends to every device; returns the endpoints that are gone for good so they can be removed. */
export async function sendToAll(subs: PushSub[], payload: { title: string; body: string; tag?: string }, data?: Data) {
  const keys = await getKeys(data);
  const opts = {
    TTL: 600,
    urgency: "high" as const,
    vapidDetails: { subject: process.env.VAPID_SUBJECT || "mailto:planner@example.com", ...keys },
  };
  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload), opts);
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    }),
  );
  return { sent, dead };
}
