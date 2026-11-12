// Work sessions: windows in the day that hold a list of tasks with no set times.
// Appointments and routines cut the windows into pieces; tasks left at the end of a day move to the next work day.
import { loadData, updateData, type Data, type Item } from "./store";
import { localNow, shiftDate, toMin } from "./schedule";

/** Rough minutes per size, only used to warn when a session looks full. Tasks Claude is doing count a third. */
export const SIZES: Record<string, number> = { quick: 15, medium: 45, big: 90 };
export const loadOf = (t: Item) => {
  const m = SIZES[String(t.size)] || 0;
  return t.ai ? Math.round(m / 3) : m;
};

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const wdOf = (date: string) => shiftDate(date, 0).wd;

export type SlotDef = { id: string; title: string; start: string; end: string; kind: string };
export type Session = SlotDef & { windows: [number, number][]; tasks: Item[]; load: number; room: number };

/** Slots for a day. Once Cat sets her own slots they replace the default, which is the whole work day on weekdays. */
export function slotDefs(d: Data, date: string): SlotDef[] {
  const wd = wdOf(date);
  const own = d.slots || [];
  if (own.length)
    return own
      .filter((s) => ((s.days as number[]) || []).includes(wd) && !((s.skips as string[]) || []).includes(date))
      .map((s) => ({ id: s.id, title: String(s.title || "Work session"), start: String(s.start), end: String(s.end), kind: String(s.kind || "work") }))
      .sort((a, b) => toMin(a.start) - toMin(b.start));
  return wd <= 5 ? [{ id: "work", title: "Work session", start: d.settings.workStart, end: d.settings.workEnd, kind: "work" }] : [];
}

/** Times taken by appointments and routines that day, buffers included, merged. */
function busy(d: Data, date: string) {
  const wd = wdOf(date);
  const spans = [
    ...d.blocks.filter((b) => b.date === date),
    ...d.routines.filter((r) => ((r.days as number[]) || []).includes(wd) && !((r.skips as string[]) || []).includes(date) && (!r.from || date >= String(r.from)) && (!r.until || date <= String(r.until))),
  ]
    .map((i) => [toMin(String(i.start)), toMin(String(i.end)) + (Number(i.buffer) || 0)])
    .sort((a, b) => a[0] - b[0]);
  const out: number[][] = [];
  for (const s of spans) {
    const l = out[out.length - 1];
    if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]);
    else out.push([...s]);
  }
  return out;
}

const timedIds = (d: Data, date: string) => new Set(d.blocks.filter((b) => b.taskId && b.date === date).map((b) => String(b.taskId)));
const order = (a: Item, b: Item) =>
  (Number(b.carries) || 0) - (Number(a.carries) || 0) || (a.priority === "top" ? 0 : 1) - (b.priority === "top" ? 0 : 1) || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);

/** The day's sessions with their free windows, their tasks and how full they look. nowMin limits room to what's left of today. */
export function sessionsFor(d: Data, date: string, nowMin: number | null = null): Session[] {
  const b = busy(d, date);
  const ss: Session[] = slotDefs(d, date).map((s) => {
    let t = toMin(s.start);
    const end = toMin(s.end), windows: [number, number][] = [];
    for (const [x, y] of b) {
      if (Math.min(x, end) - t >= 15) windows.push([t, Math.min(x, end)]);
      t = Math.max(t, y);
    }
    if (end - t >= 15) windows.push([t, end]);
    return { ...s, windows, tasks: [], load: 0, room: 0 };
  });
  const open = (s: Session) => s.windows.length && (nowMin === null || s.windows.some(([, y]) => y > nowMin));
  const timed = timedIds(d, date);
  d.tasks
    .filter((t) => t.date === date && !timed.has(t.id))
    .sort(order)
    .forEach((t) => {
      const s = ss.find((x) => x.id === t.slot && open(x)) || ss.find(open) || ss.find((x) => x.windows.length) || ss[0];
      if (s) s.tasks.push(t);
    });
  ss.forEach((s) => {
    s.room = s.windows.reduce((a, [x, y]) => a + Math.max(0, y - Math.max(x, nowMin ?? 0)), 0);
    s.load = s.tasks.filter((t) => !t.done).reduce((a, t) => a + loadOf(t), 0);
  });
  return ss;
}

export const sessionJson = (s: Session) => ({
  id: s.id,
  title: s.title,
  windows: s.windows.map(([x, y]) => `${hm(x)}-${hm(y)}`),
  room_minutes: s.room,
  sized_load_minutes: s.load,
  looks_full: s.load > s.room,
  tasks: s.tasks.map((t) => ({ id: t.id, title: t.title, ...(t.size ? { size: t.size } : {}), ...(t.ai ? { claude_working: true } : {}), ...(t.done ? { done: true } : {}), ...(t.carries ? { carried_from: t.from, carries: t.carries } : {}) })),
});

const firstWorkday = (date: string) => {
  let x = date;
  for (let i = 0; i < 7 && wdOf(x) > 5; i++) x = shiftDate(x, 1).date;
  return x;
};

/** Unticked tasks from earlier days move to the first work day from today. Returns how many moved. */
export function rollOver(d: Data, today: string) {
  const target = firstWorkday(today);
  let n = 0;
  for (const t of d.tasks) {
    if (t.done || !t.date || String(t.date) >= today) continue;
    const from = String(t.date);
    t.from = from;
    t.carries = (Number(t.carries) || 0) + 1;
    t.date = target;
    t.inbox = false;
    // A deadline that has passed or lands on the new day makes it a priority, if there's room in the Top 3.
    if (t.deadline && String(t.deadline) <= target && t.priority !== "top" && d.tasks.filter((x) => x.date === target && x.priority === "top" && !x.done).length < 3) t.priority = "top";
    n++;
  }
  return n;
}
export const needsRoll = (d: Data, today: string) => d.tasks.some((t) => !t.done && t.date && String(t.date) < today);

/** Loads the planner, first moving any unticked tasks from earlier days. */
export async function loadRolled(): Promise<Data> {
  const d = await loadData();
  const today = localNow().date;
  if (!needsRoll(d, today)) return d;
  return updateData((x) => {
    rollOver(x, today);
    return x;
  });
}

export type Moved = { id: string; title: string; from: { date: string; slot: string | null }; to: { date: string; slot: string | null; label: string } };

/**
 * When a session's sized tasks need more time than it has (an appointment came in, or tasks were added),
 * the last-added sized tasks move to the next session with room. Priorities never move. Returns what moved.
 */
export function rebalance(d: Data, date: string): Moved[] {
  const now = localNow();
  const nowFor = (ds: string) => (ds === now.date ? now.minute : null);
  if (date < now.date) return [];
  const moved: Moved[] = [];
  for (let guard = 0; guard < 40; guard++) {
    const ss = sessionsFor(d, date, nowFor(date));
    const over = ss.find((s) => s.load > s.room && s.tasks.some((t) => !t.done && loadOf(t) && t.priority !== "top"));
    if (!over) break;
    const t = [...over.tasks].reverse().find((x) => !x.done && loadOf(x) && x.priority !== "top")!;
    const prev = { date: String(t.date), slot: (t.slot as string) || null };
    const after = ss.slice(ss.indexOf(over) + 1);
    let target: { date: string; s: Session } | null = null;
    const fits = (s: Session) => s.windows.length && s.room - s.load >= loadOf(t);
    const same = after.find(fits);
    if (same) target = { date, s: same };
    let ds = date, first: { date: string; s: Session } | null = null;
    for (let i = 0; !target && i < 14; i++) {
      ds = shiftDate(ds, 1).date;
      const day = sessionsFor(d, ds, nowFor(ds)).filter((s) => s.windows.length);
      if (!first && day.length) first = { date: ds, s: day[0] };
      const f = day.find(fits);
      if (f) target = { date: ds, s: f };
    }
    target = target || first;
    if (!target) break;
    t.date = target.date;
    if (target.s.id === "work") delete t.slot;
    else t.slot = target.s.id;
    const w = target.s.windows[0];
    moved.push({ id: t.id, title: String(t.title), from: prev, to: { date: target.date, slot: (t.slot as string) || null, label: `${target.s.title}${w ? ` from ${hm(w[0])}` : ""}` } });
  }
  return moved;
}

/** The first session from now with room for the task (or any time left), up to 2 weeks ahead. */
export function nextSession(d: Data, t: Item): { date: string; slot: string | null } | null {
  const now = localNow();
  let ds = now.date, fallback: { date: string; slot: string | null } | null = null;
  for (let i = 0; i < 14; i++, ds = shiftDate(ds, 1).date) {
    for (const s of sessionsFor(d, ds, ds === now.date ? now.minute : null)) {
      if (!s.room) continue;
      const pick = { date: ds, slot: s.id === "work" ? null : s.id };
      if (!fallback) fallback = pick;
      if (s.room - s.load >= loadOf(t)) return pick;
    }
  }
  return fallback;
}
