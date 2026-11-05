import { get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";

export type Item = Record<string, unknown> & { id: string };
export type Settings = { workStart: string; workEnd: string; leadMin: number; morning?: string | null; palette?: string };
export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string }; addedAt: number };
export type Data = {
  tasks: Item[];
  blocks: Item[];
  routines: Item[];
  settings: Settings;
  subs: PushSub[];
  sent: Record<string, number>;
  vapid?: { publicKey: string; privateKey: string };
  claudeKey?: string;
};
export const COLLECTIONS = ["tasks", "blocks", "routines"] as const;
export type Collection = (typeof COLLECTIONS)[number];

const BLOB_PATH = "planner/data.json";
const LOCAL_PATH = path.join(process.cwd(), ".localdata.json");

export const emptyData = (): Data => ({
  tasks: [],
  blocks: [],
  routines: [],
  settings: { workStart: "09:00", workEnd: "16:00", leadMin: 10 },
  subs: [],
  sent: {},
});

const merge = (raw: Partial<Data>): Data => {
  const base = emptyData();
  return { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
};

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function loadData(): Promise<Data> {
  if (!useBlob()) {
    try {
      return merge(JSON.parse(await fs.readFile(LOCAL_PATH, "utf8")));
    } catch {
      return emptyData();
    }
  }
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return emptyData();
  const text = await new Response(res.stream).text();
  return merge(JSON.parse(text));
}

async function writeData(data: Data) {
  const body = JSON.stringify(data);
  if (!useBlob()) {
    await fs.writeFile(LOCAL_PATH, body);
    return;
  }
  await put(BLOB_PATH, body, {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

// One planner, one person: queue changes so two quick saves never overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
export function updateData<T>(fn: (d: Data) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const d = await loadData();
    const out = await fn(d);
    await writeData(d);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}
