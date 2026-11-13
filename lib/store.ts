import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import postgres from "postgres";
import { promises as fs } from "fs";
import path from "path";

export type Item = Record<string, unknown> & { id: string };
export type Settings = { workStart: string; workEnd: string; leadMin: number; morning?: string | null; palette?: string; billsSeeded?: boolean };
export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string }; addedAt: number };
export type Data = {
  tasks: Item[];
  blocks: Item[];
  routines: Item[];
  slots: Item[];
  /** Bills to pay, with banking details. Kept server-side only, like everything else, behind the login. */
  bills: Item[];
  settings: Settings;
  subs: PushSub[];
  sent: Record<string, number>;
  vapid?: { publicKey: string; privateKey: string };
  claudeKey?: string;
  lastCheck?: number;
  /** Wrong-password attempts: when each recent one happened, and when a lock ends. */
  login?: { fails: number[]; lockedUntil?: number };
};
export const COLLECTIONS = ["tasks", "blocks", "routines", "slots", "bills"] as const;
export type Collection = (typeof COLLECTIONS)[number];

const BLOB_PATH = "planner/data.json";
const LOCAL_PATH = path.join(process.cwd(), ".localdata.json");

export const emptyData = (): Data => ({
  tasks: [],
  blocks: [],
  routines: [],
  slots: [],
  bills: [],
  settings: { workStart: "09:00", workEnd: "16:00", leadMin: 10 },
  subs: [],
  sent: {},
});

const merge = (raw: Partial<Data>): Data => {
  const base = emptyData();
  return { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
};

const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** The data plus the file's version tag, so a save can check nothing else changed the file in between. */
async function fileLoad(): Promise<{ data: Data; etag: string | null }> {
  if (!useBlob()) {
    try {
      return { data: merge(JSON.parse(await fs.readFile(LOCAL_PATH, "utf8"))), etag: null };
    } catch {
      return { data: emptyData(), etag: null };
    }
  }
  const res = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return { data: emptyData(), etag: null };
  const text = await new Response(res.stream).text();
  return { data: merge(JSON.parse(text)), etag: res.blob.etag || null };
}


async function fileWrite(data: Data, etag: string | null) {
  const body = JSON.stringify(data);
  if (!useBlob()) {
    // Write beside the file, then swap it in, so a read never catches a half-written file.
    const tmp = `${LOCAL_PATH}.${process.pid}.tmp`;
    await fs.writeFile(tmp, body);
    await fs.rename(tmp, LOCAL_PATH);
    return;
  }
  await put(BLOB_PATH, body, {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    // Only save if the file is still the version that was read. If the phone, the Claude connector
    // or the alert check saved in between, the save is refused and updateData starts again from the new file.
    ...(etag ? { ifMatch: etag } : {}),
  });
}


/* ---------- Supabase (Postgres) ----------
   When POSTGRES_URL is set, every task, event, routine and slot is its own row, and settings and
   alert state are rows in a small key-value table. A save changes only the rows that differ, so two
   saves at the same moment from different places both land. The first time the planner starts with
   a database, it copies the data file across once; the file is left untouched as a fallback.
   Set PLANNER_STORE=blob in Vercel to go back to the data file. */
type Sql = ReturnType<typeof postgres>;
const KV_KEYS = ["settings", "subs", "sent", "vapid", "claudeKey", "lastCheck", "login"] as const;
const MARKER_BLOB = "planner/migrated.json";
const MARKER_LOCAL = path.join(process.cwd(), ".localdata.migrated");

const pgUrl = () => (process.env.PLANNER_STORE === "blob" ? "" : process.env.POSTGRES_URL || "");
let sqlClient: Sql | null = null;
function db(): Sql {
  if (sqlClient) return sqlClient;
  // Only the address parts are used. Extra options on the link (Supabase adds some) are dropped,
  // because the driver would pass unknown ones to the database and the connection would be refused.
  const u = new URL(pgUrl());
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  sqlClient = postgres({
    host: u.hostname,
    port: Number(u.port) || 5432,
    database: decodeURIComponent(u.pathname.slice(1)) || "postgres",
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: local ? false : "require",
    prepare: false, // Supabase's pooled connection doesn't keep prepared statements
    max: 1,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return sqlClient;
}

/** Drops the connection so the next call opens a fresh one. */
function resetDb() {
  const old = sqlClient;
  sqlClient = null;
  schemaReady = null;
  if (old) old.end({ timeout: 0 }).catch(() => undefined);
}
/**
 * Runs one piece of database work with a time limit. A server instance can be paused between requests,
 * and the connection it held may be dead when it wakes; a query sent down a dead connection never answers.
 * On a timeout or a dropped connection, the connection is replaced and the work runs once more.
 * Everything passed in is safe to run twice: reads, and writes that set a row to a value.
 */
async function withDb<T>(work: (sql: Sql) => Promise<T>, ms = 8000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(db()),
        new Promise<never>((_, no) => {
          timer = setTimeout(() => no(Object.assign(new Error("The planner's database took too long to answer."), { code: "PLANNER_TIMEOUT" })), ms);
        }),
      ]);
    } catch (e) {
      const code = String((e as { code?: string }).code || "");
      const dropped = ["PLANNER_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "ECONNRESET", "EPIPE", "ETIMEDOUT"].includes(code);
      if (!dropped || attempt >= 1) throw e;
      console.error("Planner database connection replaced after", code);
      resetDb();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

let schemaReady: Promise<unknown> | null = null;
function ensureSchema() {
  if (!schemaReady) {
    // One round trip. Row level security with no policies locks the tables to the planner's own
    // server connection: Supabase's public API can't read them.
    schemaReady = db()
      .unsafe(
        `create table if not exists planner_items (
           seq bigint generated always as identity,
           col text not null,
           id text not null,
           data jsonb not null,
           updated_at timestamptz not null default now(),
           primary key (col, id));
         create table if not exists planner_kv (
           key text primary key,
           data jsonb not null,
           updated_at timestamptz not null default now());
         alter table planner_items enable row level security;
         alter table planner_kv enable row level security;`,
      )
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

async function pgLoad(sql: Sql = db()): Promise<Data> {
  // Items and settings in one round trip: the database is on another continent from the server.
  const rows = await sql<{ t: string; k: string; data: unknown }[]>`
    select 'i' as t, col as k, data, seq from planner_items
    union all select 'k', key, data, 0 from planner_kv
    order by 4`;
  const raw: Record<string, unknown> = {};
  for (const c of COLLECTIONS) raw[c] = [];
  for (const r of rows) {
    if (r.t === "i" && (COLLECTIONS as readonly string[]).includes(r.k)) (raw[r.k] as Item[]).push(r.data as Item);
    else if (r.t === "k" && (KV_KEYS as readonly string[]).includes(r.k)) raw[r.k] = r.data;
  }
  return merge(raw as Partial<Data>);
}

const snapshot = (d: Data) => {
  const rows = new Map<string, string>();
  for (const c of COLLECTIONS) for (const it of d[c]) rows.set(`${c}\n${it.id}`, JSON.stringify(it));
  const kv = new Map<string, string>();
  for (const k of KV_KEYS) if (d[k] !== undefined && d[k] !== null) kv.set(k, JSON.stringify(d[k]));
  return { rows, kv };
};

/** The statements that write only what changed between the data as it was read and as it is now. */
function diffQueries(sql: Sql, before: ReturnType<typeof snapshot>, d: Data) {
  const after = snapshot(d);
  const j = (text: string) => sql.json(JSON.parse(text));
  const q = [];
  for (const [key, text] of after.rows) {
    if (before.rows.get(key) === text) continue;
    const [col, id] = key.split("\n");
    q.push(sql`insert into planner_items (col, id, data) values (${col}, ${id}, ${j(text)})
      on conflict (col, id) do update set data = excluded.data, updated_at = now()`);
  }
  for (const key of before.rows.keys()) {
    if (after.rows.has(key)) continue;
    const [col, id] = key.split("\n");
    q.push(sql`delete from planner_items where col = ${col} and id = ${id}`);
  }
  for (const [key, text] of after.kv) {
    if (before.kv.get(key) === text) continue;
    q.push(sql`insert into planner_kv (key, data) values (${key}, ${j(text)})
      on conflict (key) do update set data = excluded.data, updated_at = now()`);
  }
  for (const key of before.kv.keys()) if (!after.kv.has(key)) q.push(sql`delete from planner_kv where key = ${key}`);
  return q;
}

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
async function markerExists() {
  try {
    if (!hasBlob()) return !!(await fs.stat(MARKER_LOCAL).catch(() => null));
    const r = await get(MARKER_BLOB, { access: "private", useCache: false });
    return !!r && r.statusCode === 200;
  } catch {
    return false;
  }
}
async function writeMarker(info: object) {
  const body = JSON.stringify(info);
  if (!hasBlob()) return fs.writeFile(MARKER_LOCAL, body);
  await put(MARKER_BLOB, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
}

/** Copies the data file into the database once. Safe to call from several server instances at the same time. */
async function migrateOnce() {
  // The usual case is one round trip: the copy was made on an earlier start.
  try {
    const done = await withDb((q) => q`select 1 from planner_kv where key = 'migrated'`);
    if (done.length) return;
  } catch (e) {
    if ((e as { code?: string }).code !== "42P01") throw e; // anything but "the table doesn't exist yet"
  }
  const sql = db();
  await ensureSchema();
  const { data } = await fileLoad();
  const counts = Object.fromEntries(COLLECTIONS.map((c) => [c, data[c].length]));
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7426001)`;
    const again = await tx`select 1 from planner_kv where key = 'migrated'`;
    if (again.length) return;
    const existing = await tx`select 1 from planner_items limit 1`;
    if (!existing.length) for (const q of diffQueries(tx as unknown as Sql, { rows: new Map(), kv: new Map() }, data)) await q;
    await tx`insert into planner_kv (key, data) values ('migrated', ${tx.json({ at: new Date().toISOString(), counts })})`;
  });
  await writeMarker({ at: new Date().toISOString(), counts });
  console.log("Planner data copied to the database", JSON.stringify(counts));
}

let pgMode: "pg" | null = null;
/** True when the database is the planner's store. Before the first copy has succeeded, a database problem falls back to the data file. */
async function usePg(): Promise<boolean> {
  if (!pgUrl()) return false;
  if (pgMode) return true;
  try {
    await migrateOnce();
    pgMode = "pg";
    return true;
  } catch (e) {
    console.error("Planner database isn't reachable", e instanceof Error ? e.message : e);
    // Once data lives in the database, never fall back: saving to the file as well would split the planner in two.
    if (await markerExists()) throw new Error("The planner's database couldn't be reached. Try again in a moment.");
    return false;
  }
}

export async function loadData(): Promise<Data> {
  if (await usePg()) return withDb((sql) => pgLoad(sql));
  return (await fileLoad()).data;
}

// Within one server instance, changes queue up. In the database a save writes only the rows it changed.
// On the data file, a version check catches a clash and the change is applied again to the fresh file.
let queue: Promise<unknown> = Promise.resolve();
export function updateData<T>(fn: (d: Data) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    if (await usePg()) {
      const data = await withDb((sql) => pgLoad(sql));
      const before = snapshot(data);
      const out = await fn(data);
      // Sent together as one batch, so a save costs 1 extra round trip however many rows it touches.
      if (diffQueries(db(), before, data).length) await withDb((sql) => sql.begin((tx) => diffQueries(tx as unknown as Sql, before, data)));
      return out;
    }
    for (let attempt = 0; ; attempt++) {
      const { data, etag } = await fileLoad();
      const out = await fn(data);
      try {
        await fileWrite(data, etag);
        return out;
      } catch (e) {
        if (!(e instanceof BlobPreconditionFailedError) || attempt >= 5) throw e;
        await new Promise((r) => setTimeout(r, 40 + Math.random() * 120 * (attempt + 1)));
      }
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Which store is in use, for the Settings screen and for checking the move went through. */
export async function storeInfo() {
  if (!(await usePg())) return { store: hasBlob() ? "file" : "local file" };
  const rows = await withDb((sql) => sql<{ col: string; n: number }[]>`select col, count(*)::int as n from planner_items group by col`);
  const m = await withDb((sql) => sql<{ data: unknown }[]>`select data from planner_kv where key = 'migrated'`);
  return { store: "database", counts: Object.fromEntries(rows.map((r) => [r.col, r.n])), migrated: m[0]?.data ?? null };
}

/** Once a day, saves a full copy of the planner beside the old data file and keeps the last 14. Never throws. */
export async function dailyBackup(today: string) {
  try {
    if (!hasBlob() || !(await usePg())) return;
    const last = await withDb((sql) => sql<{ data: unknown }[]>`select data from planner_kv where key = 'lastBackup'`);
    if (last[0]?.data === today) return;
    const data = await withDb((sql) => pgLoad(sql));
    // Mark the day first, so a slow copy is never started twice by the next check.
    await withDb((sql) => sql`insert into planner_kv (key, data) values ('lastBackup', ${sql.json(today)})
      on conflict (key) do update set data = excluded.data, updated_at = now()`);
    const limit = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("storage took too long")), 15000))]);
    await limit(put(`planner/backups/${today}.json`, JSON.stringify(data), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" }));
    const old = (await limit(list({ prefix: "planner/backups/" }))).blobs.map((b) => b.pathname).sort().slice(0, -14);
    if (old.length) await limit(del(old));
  } catch (e) {
    console.error("Planner backup failed", e instanceof Error ? e.message : e);
  }
}
