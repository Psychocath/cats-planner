// A small MCP server (Streamable HTTP, stateless, JSON responses) so Claude can read and change the planner.
import { updateData, type Collection, type Data, type Item } from "./store";
import { itemsFor, localNow, toMin } from "./schedule";
import { loadRolled, nextSession, rebalance, sessionJson, sessionsFor, SIZES } from "./slots";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = {
  // A real calendar date, so 31 Feb or month 13 can't be saved and then show on no day.
  test(v: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split("-").map(Number);
    const x = new Date(Date.UTC(y, m - 1, d));
    return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
  },
};
/** Other appointments and routines that day whose times overlap this one. Saved anyway; reported so Cat hears about it. */
function clashesWith(d: Data, rec: Item) {
  if (!rec.date || !rec.start || !rec.end) return [];
  const date = String(rec.date), a = toMin(String(rec.start)), b = toMin(String(rec.end));
  return itemsFor(d, date, wdOf(date))
    .filter((i) => i.key.split("|")[1].slice(2) !== rec.id && toMin(i.start) < b && toMin(i.end) > a)
    .map((i) => ({ title: i.title, start: i.start, end: i.end }));
}
const KINDS = ["work", "family", "admin", "me"];
const COLS: Collection[] = ["tasks", "blocks", "routines", "slots"];
const SIZEK = Object.keys(SIZES);
const DAYN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const wdOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
};
const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export class ToolError extends Error {}
const need = (ok: unknown, msg: string) => {
  if (!ok) throw new ToolError(msg);
};
const checkTimes = (start: unknown, end: unknown) => {
  need(TIME.test(String(start)) && TIME.test(String(end)), "Use 24-hour times like 09:30.");
  need(toMin(String(end)) > toMin(String(start)), "The end time must be after the start time.");
};
const toSteps = (v: unknown) =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? { text: x.trim(), done: false } : { text: String((x as { text?: unknown })?.text || "").trim(), done: !!(x as { done?: unknown })?.done }))
        .filter((x) => x.text)
        .slice(0, 30)
    : null;
const extras = (a: Record<string, unknown>) => {
  const o: Record<string, unknown> = {};
  if (typeof a.remind === "number") o.remind = Math.max(-1, Math.min(10080, Math.round(a.remind)));
  if (typeof a.remind2 === "number") o.remind2 = Math.max(0, Math.min(10080, Math.round(a.remind2)));
  if (typeof a.buffer === "number" && a.buffer > 0) o.buffer = Math.min(120, Math.round(a.buffer));
  if (a.notes) o.notes = String(a.notes).slice(0, 2000);
  if (a.location) o.location = String(a.location).trim().slice(0, 200);
  const st = toSteps(a.steps);
  if (st) o.steps = st;
  return o;
};
const kindOf = (k: unknown) => (KINDS.includes(String(k)) ? String(k) : "work");

const str = (description: string) => ({ type: "string", description });
export const TOOLS = [
  {
    name: "get_plan",
    description:
      "Read the planner for one or more days: appointments (time blocks) and routines with ids, tasks, Top 3, and the day's work sessions. A work session is a window that holds a list of tasks with no set times; appointments and routines cut its windows. Each session shows its tasks, room left and whether its sized tasks look like more than fits. Dates are in Cape Town time.",
    inputSchema: {
      type: "object",
      properties: {
        date: str("First day, YYYY-MM-DD. Defaults to today."),
        days: { type: "integer", minimum: 1, maximum: 14, description: "How many days to include. Default 1." },
      },
    },
  },
  {
    name: "list_tasks",
    description: "List tasks with ids, due dates, priority (top = Top 3) and estimated minutes.",
    inputSchema: { type: "object", properties: { include_done: { type: "boolean", description: "Include finished tasks. Default false." } } },
  },
  {
    name: "add_block",
    description: "Add a one-off time block on a date. Use it for appointments and anything with a real time. Work sessions that day split around it, and if sized tasks no longer fit, the last-added ones move to the next session with room (the result lists what moved; tell Cat).",
    inputSchema: {
      type: "object",
      required: ["title", "date", "start", "end"],
      properties: {
        title: str("What the block is for."),
        date: str("YYYY-MM-DD"),
        start: str("HH:MM, 24-hour"),
        end: str("HH:MM, 24-hour"),
        kind: { type: "string", enum: KINDS, description: "Colour group. Default work." },
        remind: { type: "integer", minimum: -1, maximum: 10080, description: "Minutes before the start to send the phone alert. -1 for none, 0 at start. Leave out to use the default." },
        remind2: { type: "integer", minimum: 0, maximum: 10080, description: "Optional second alert, minutes before the start." },
        buffer: { type: "integer", minimum: 0, maximum: 120, description: "Minutes of buffer kept free after it ends (optional)." },
        location: str("Where it happens: an address or place name (optional)."),
        notes: str("Extra details (optional)."),
        steps: { type: "array", items: { type: "string" }, description: "Small steps to break it into (optional)." },
      },
    },
  },
  {
    name: "add_task",
    description: "Add a task. Tasks need no time: a task with a planned date drops into that day's work session (or the slot you name). Set date to 'next' to put it in the next work session with room from now. Leave date empty for the Inbox. deadline is the last day it can be done. priority 'top' makes it one of that day's priorities (max 3 per day). Unticked tasks move to the next work day's first session overnight.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: str("The task."),
        date: str("Planned day: the day Cat means to do it, YYYY-MM-DD (optional)."),
        deadline: str("The last day it can be done, YYYY-MM-DD (optional). Separate from the planned day."),
        waiting: str("What has to happen first, if the task is blocked (optional)."),
        priority: { type: "string", enum: ["top", "normal"] },
        mins: { type: "integer", minimum: 5, description: "Estimated minutes (optional, rarely needed: prefer size)." },
        size: { type: "string", enum: SIZEK, description: "Rough size (optional): quick, medium or big. Only used to warn when a session looks full and to move overflow." },
        ai: { type: "boolean", description: "True when Claude is doing the task for Cat (it shows as 'Claude working' and counts less against the session)." },
        slot: str("Work slot id from get_plan to put it in (optional). Leave out to use the first session that day."),
        for: str("The event date this task is preparation for, YYYY-MM-DD (optional). Shows as a deadline on that day."),
        steps: { type: "array", items: { type: "string" }, description: "Small steps to break it into (optional)." },
      },
    },
  },
  {
    name: "add_routine",
    description: "Add something that repeats every week on the given weekdays.",
    inputSchema: {
      type: "object",
      required: ["title", "start", "end", "days"],
      properties: {
        title: str("What repeats."),
        start: str("HH:MM, 24-hour"),
        end: str("HH:MM, 24-hour"),
        days: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 }, description: "1=Mon … 7=Sun" },
        kind: { type: "string", enum: KINDS },
        remind: { type: "integer", minimum: -1, maximum: 10080, description: "Minutes before the start to send the phone alert. -1 for none, 0 at start. Leave out to use the default." },
        remind2: { type: "integer", minimum: 0, maximum: 10080, description: "Optional second alert, minutes before the start." },
        buffer: { type: "integer", minimum: 0, maximum: 120, description: "Minutes of buffer kept free after it ends (optional)." },
        location: str("Where it happens: an address or place name (optional)."),
        notes: str("Extra details (optional)."),
      },
    },
  },
  {
    name: "add_slot",
    description: "Add a weekly work slot: a window on given weekdays that holds tasks. Until Cat has any slots, each weekday's work hours act as one 'Work session'; adding the first slot replaces that default, so add every window she wants.",
    inputSchema: {
      type: "object",
      required: ["title", "start", "end", "days"],
      properties: {
        title: str("Name, e.g. 'Client work' or 'Admin'."),
        start: str("HH:MM, 24-hour"),
        end: str("HH:MM, 24-hour"),
        days: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 }, description: "1=Mon … 7=Sun" },
        kind: { type: "string", enum: KINDS },
      },
    },
  },
  {
    name: "update_item",
    description: "Change fields on an existing block, task, routine or slot. Only the fields you pass change. Moving a task to another day: change date (and slot if needed); it drops into that day's session. Changing a block's time or day reshapes the work sessions and may move overflow (listed in the result).",
    inputSchema: {
      type: "object",
      required: ["collection", "id", "fields"],
      properties: {
        collection: { type: "string", enum: COLS },
        id: str("Item id from get_plan or list_tasks."),
        fields: { type: "object", description: "e.g. {title, date (tasks: planned day, or 'next' for the next work session with room), deadline (tasks: last possible day, null to clear), waiting (tasks: what it is blocked on, null to clear), for (tasks: event date YYYY-MM-DD), start, end, kind, notes, location (blocks and routines; null to clear), until (routines: last date YYYY-MM-DD, null to repeat forever), steps ([text] or [{text, done}]; [] to clear), size (tasks: quick, medium, big; null to clear), ai (tasks: true when Claude is doing it), slot (tasks: slot id; null for the first session), remind (minutes before; -1 none; null for default), remind2 (null to clear), buffer (minutes after; 0 to clear), priority, mins, done, days}" },
      },
    },
  },
  {
    name: "complete_task",
    description: "Mark a task done (or not done).",
    inputSchema: { type: "object", required: ["id"], properties: { id: str("Task id."), done: { type: "boolean", description: "Default true." } } },
  },
  {
    name: "skip_routine",
    description: "Skip a routine on one date only, e.g. a pickup on a sick day. Pass undo=true to bring it back.",
    inputSchema: {
      type: "object",
      required: ["id", "date"],
      properties: { id: str("Routine id."), date: str("YYYY-MM-DD"), undo: { type: "boolean" } },
    },
  },
  {
    name: "delete_item",
    description: "Delete a block, task, routine or slot for good. Confirm with the person first.",
    inputSchema: { type: "object", required: ["collection", "id"], properties: { collection: { type: "string", enum: COLS }, id: str("Item id.") } },
  },
  {
    name: "update_settings",
    description: "Change work hours, the default reminder (minutes before), or the morning planning alert time.",
    inputSchema: {
      type: "object",
      properties: { workStart: str("HH:MM"), workEnd: str("HH:MM"), leadMin: { type: "integer", minimum: 0, maximum: 60 }, morning: str("Daily 'Plan your day' alert time HH:MM, or empty to turn off.") },
    },
  },
];

function freeWork(d: Data, date: string) {
  const ws = toMin(d.settings.workStart), we = toMin(d.settings.workEnd);
  const bufs = new Map([...d.blocks, ...d.routines].map((x) => [x.id, Number(x.buffer) || 0]));
  const spans = itemsFor(d, date, wdOf(date)).map((i) => [toMin(i.start), toMin(i.end) + (bufs.get(i.key.split("|")[1].slice(2)) || 0)]).sort((a, b) => a[0] - b[0]);
  let busy = 0, cur: number[] | null = null;
  const flush = () => cur && (busy += Math.max(0, Math.min(cur[1], we) - Math.max(cur[0], ws)));
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else { flush(); cur = [...s]; }
  }
  flush();
  return Math.max(0, we - ws - busy);
}

const TASK_KEYS = ["id", "title", "date", "slot", "size", "ai", "deadline", "for", "waiting", "priority", "mins", "actual", "done", "steps", "carries", "from"];
const pick = (i: Item, keys: string[]) => Object.fromEntries(keys.filter((k) => i[k] !== undefined && i[k] !== null).map((k) => [k, i[k]]));

export async function call(name: string, a: Record<string, unknown>) {
  const now = localNow();
  switch (name) {
    case "get_plan": {
      const d = await loadRolled();
      const start = a.date ? String(a.date) : now.date;
      need(DATE.test(start), "Use dates like 2026-11-06.");
      const n = Math.min(14, Math.max(1, Number(a.days) || 1));
      const days = [];
      for (let k = 0; k < n; k++) {
        const date = addDays(start, k), wd = wdOf(date);
        const blocks = d.blocks.filter((b) => b.date === date).map((b) => ({ ...pick(b, ["id", "title", "start", "end", "kind", "remind", "remind2", "buffer", "location", "notes", "steps"]), type: "block" }));
        const routines = d.routines
          .filter((r) => ((r.days as number[]) || []).includes(wd) && !((r.skips as string[]) || []).includes(date) && (!r.from || date >= String(r.from)) && (!r.until || date <= String(r.until)))
          .map((r) => ({ ...pick(r, ["id", "title", "start", "end", "kind", "remind", "remind2", "buffer", "location", "notes", "steps", "until"]), type: "routine" }));
        const tasks = d.tasks.filter((t) => t.date === date || t.for === date || t.deadline === date).map((t) => pick(t, TASK_KEYS));
        days.push({
          date,
          weekday: DAYN[wd - 1],
          schedule: ([...blocks, ...routines] as Record<string, unknown>[]).sort((x, y) => toMin(String(x.start)) - toMin(String(y.start))),
          tasks,
          free_work_minutes: wd <= 5 ? freeWork(d, date) : null,
          sessions: sessionsFor(d, date, date === now.date ? now.minute : null).map(sessionJson),
        });
      }
      return { today: now.date, now: `${String(Math.floor(now.minute / 60)).padStart(2, "0")}:${String(now.minute % 60).padStart(2, "0")}`, settings: d.settings, slots: d.slots.length ? d.slots.map((x) => pick(x, ["id", "title", "start", "end", "days", "kind"])) : "No slots set: each weekday's work hours act as one 'Work session' (id 'work').", days };
    }
    case "list_tasks": {
      const d = await loadRolled();
      return d.tasks.filter((t) => a.include_done || !t.done).map((t) => pick(t, TASK_KEYS));
    }
    case "add_block": {
      need(String(a.title || "").trim(), "Give the block a title.");
      need(DATE.test(String(a.date)), "Use dates like 2026-11-06.");
      checkTimes(a.start, a.end);
      const rec: Item = { id: uid(), title: String(a.title).trim(), date: String(a.date), start: String(a.start), end: String(a.end), kind: kindOf(a.kind), ...extras(a) };
      return updateData((d) => {
        d.blocks.push(rec);
        const moved = rebalance(d, rec.date as string);
        const clashes = clashesWith(d, rec);
        return { added: rec, moved, ...(clashes.length ? { clashes, note: "Saved, but it overlaps the items in clashes. Tell Cat." } : {}) };
      });
    }
    case "add_task": {
      need(String(a.title || "").trim(), "Give the task a title.");
      const next = a.date === "next";
      let date = a.date && !next ? String(a.date) : null;
      need(!date || DATE.test(date), "Use dates like 2026-11-06, or 'next' for the next work session.");
      const priority = a.priority === "top" ? "top" : "normal";
      const rec: Item = { id: uid(), title: String(a.title).trim(), date, priority, mins: Number(a.mins) || null, done: false, createdAt: Date.now() };
      const st = toSteps(a.steps);
      if (st) rec.steps = st;
      if (a.for) { need(DATE.test(String(a.for)), "Use dates like 2026-12-04 for 'for'."); rec.for = String(a.for); }
      if (a.deadline) { need(DATE.test(String(a.deadline)), "Use dates like 2026-12-04 for deadline."); rec.deadline = String(a.deadline); }
      if (a.waiting) rec.waiting = String(a.waiting).trim().slice(0, 200);
      if (SIZEK.includes(String(a.size))) rec.size = String(a.size);
      if (a.ai) rec.ai = true;
      if (a.slot && a.slot !== "work") rec.slot = String(a.slot);
      if (!date && !next) rec.inbox = true;
      return updateData((d) => {
        if (next) {
          const at = nextSession(d, rec);
          need(at, "There's no work session in the next 2 weeks to put it in.");
          date = at!.date;
          rec.date = date;
          if (at!.slot) rec.slot = at!.slot;
          else delete rec.slot;
        }
        if (priority === "top" && date) {
          need(d.tasks.filter((t) => t.date === date && t.priority === "top" && !t.done).length < 3, "That day already has 3 Top tasks.");
        }
        d.tasks.push(rec);
        const moved = date && (rec.size || rec.mins) ? rebalance(d, date) : [];
        return { added: rec, moved };
      });
    }
    case "add_slot": {
      need(String(a.title || "").trim(), "Give the slot a name.");
      checkTimes(a.start, a.end);
      const days = [...new Set(((a.days as unknown[]) || []).map(Number))].filter((n) => n >= 1 && n <= 7).sort();
      need(days.length, "Pick at least one weekday (1=Mon … 7=Sun).");
      const rec: Item = { id: uid(), title: String(a.title).trim(), start: String(a.start), end: String(a.end), days, kind: kindOf(a.kind) };
      await updateData((d) => void d.slots.push(rec));
      return { added: rec };
    }
    case "add_routine": {
      need(String(a.title || "").trim(), "Give the routine a title.");
      checkTimes(a.start, a.end);
      const days = [...new Set(((a.days as unknown[]) || []).map(Number))].filter((n) => n >= 1 && n <= 7).sort();
      need(days.length, "Pick at least one weekday (1=Mon … 7=Sun).");
      const rec: Item = { id: uid(), title: String(a.title).trim(), start: String(a.start), end: String(a.end), days, kind: kindOf(a.kind), skips: [], ...extras(a) };
      await updateData((d) => void d.routines.push(rec));
      return { added: rec };
    }
    case "update_item": {
      const col = a.collection as Collection;
      need(COLS.includes(col), "collection must be tasks, blocks, routines or slots.");
      const f = (a.fields || {}) as Record<string, unknown>;
      delete f.id;
      return updateData((d) => {
        const i = d[col].findIndex((x) => x.id === a.id);
        need(i >= 0, "No item with that id. Use get_plan or list_tasks to find it.");
        const next = { ...d[col][i], ...f };
        if (f.title !== undefined) { next.title = String(f.title).trim(); need(next.title, "The title can't be empty."); }
        if (col !== "tasks") checkTimes(next.start, next.end);
        if (col === "tasks" && f.date === "next") {
          const at = nextSession(d, next as Item);
          need(at, "There's no work session in the next 2 weeks to put it in.");
          next.date = at!.date;
          if (at!.slot) next.slot = at!.slot;
          else delete next.slot;
        }
        if (next.date) need(DATE.test(String(next.date)), col === "tasks" ? "Use dates like 2026-11-06, or 'next' for the next work session." : "Use dates like 2026-11-06.");
        if (col === "tasks" && next.priority === "top" && next.date && !next.done && (d[col][i].priority !== "top" || next.date !== d[col][i].date)) {
          need(d.tasks.filter((t) => t.id !== a.id && t.date === next.date && t.priority === "top" && !t.done).length < 3, "That day already has 3 Top tasks.");
        }
        if (f.kind !== undefined) next.kind = kindOf(f.kind);
        for (const k of ["remind2", "buffer"]) if (f[k] === null || f[k] === 0 && k === "buffer") delete next[k];
        if (f.location === null || f.location === "") delete next.location;
        else if (f.location !== undefined) next.location = String(f.location).trim().slice(0, 200);
        if (f.for === null || f.for === "") delete next.for;
        else if (f.for !== undefined) need(DATE.test(String(f.for)), "Use dates like 2026-12-04 for 'for'.");
        if (f.deadline === null || f.deadline === "") delete next.deadline;
        else if (f.deadline !== undefined) need(DATE.test(String(f.deadline)), "Use dates like 2026-12-04 for deadline.");
        if (f.waiting === null || f.waiting === "") delete next.waiting;
        if (col === "tasks" && f.date) next.inbox = false;
        if (f.until === null || f.until === "") delete next.until;
        else if (f.until !== undefined) need(DATE.test(String(f.until)), "Use dates like 2026-12-31 for until.");
        if (f.steps !== undefined) { const st = toSteps(f.steps); if (st && st.length) next.steps = st; else delete next.steps; }
        if (col === "tasks") {
          if (f.size === null || f.size === "") delete next.size;
          else if (f.size !== undefined) { need(SIZEK.includes(String(f.size)), "size must be quick, medium or big."); next.size = String(f.size); }
          if (f.ai === false || f.ai === null) delete next.ai;
          if (f.slot === null || f.slot === "" || f.slot === "work") delete next.slot;
          // Re-planned by hand, so it no longer counts as moved from an earlier day.
          if (f.date !== undefined && next.date !== d[col][i].date) { delete next.carries; delete next.from; }
        }
        if (col === "slots" && f.days !== undefined) {
          const days = [...new Set(((f.days as unknown[]) || []).map(Number))].filter((n) => n >= 1 && n <= 7).sort();
          need(days.length, "Pick at least one weekday (1=Mon … 7=Sun).");
          next.days = days;
        }
        if (f.remind === null) delete next.remind;
        else if (f.remind !== undefined) next.remind = Math.max(-1, Math.min(10080, Math.round(Number(f.remind))));
        delete next.example;
        d[col][i] = next as Item;
        const moved = (col === "blocks" || (col === "tasks" && (next.size || next.mins))) && next.date ? rebalance(d, String(next.date)) : [];
        const clashes = col === "blocks" ? clashesWith(d, next as Item) : [];
        return { updated: next, moved, ...(clashes.length ? { clashes, note: "Saved, but it overlaps the items in clashes. Tell Cat." } : {}) };
      });
    }
    case "complete_task":
      return updateData((d) => {
        const t = d.tasks.find((x) => x.id === a.id);
        need(t, "No task with that id.");
        t!.done = a.done === undefined ? true : !!a.done;
        return { updated: t };
      });
    case "skip_routine":
      need(DATE.test(String(a.date)), "Use dates like 2026-11-06.");
      return updateData((d) => {
        const r = d.routines.find((x) => x.id === a.id);
        need(r, "No routine with that id.");
        const skips = new Set((r!.skips as string[]) || []);
        a.undo ? skips.delete(String(a.date)) : skips.add(String(a.date));
        r!.skips = [...skips];
        return { updated: r };
      });
    case "delete_item": {
      const col = a.collection as Collection;
      need(COLS.includes(col), "collection must be tasks, blocks, routines or slots.");
      return updateData((d) => {
        const before = d[col].length;
        d[col] = d[col].filter((x) => x.id !== a.id);
        need(d[col].length < before, "No item with that id.");
        return { deleted: a.id };
      });
    }
    case "update_settings":
      return updateData((d) => {
        const s = { ...d.settings };
        if (a.workStart !== undefined) s.workStart = String(a.workStart);
        if (a.workEnd !== undefined) s.workEnd = String(a.workEnd);
        checkTimes(s.workStart, s.workEnd);
        if (a.morning !== undefined) s.morning = a.morning && TIME.test(String(a.morning)) ? String(a.morning) : null;
        if (a.leadMin !== undefined) s.leadMin = Math.max(0, Math.min(60, Number(a.leadMin) || 0));
        d.settings = s;
        return { settings: s };
      });
  }
  throw new ToolError(`Unknown tool: ${name}`);
}

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export async function handleRpc(msg: Rpc) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined) return null; // notification
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion || "");
      return ok({
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[1],
        capabilities: { tools: {} },
        serverInfo: { name: "cats-planner", version: "1.0.0" },
        instructions:
          "Cat's day planner. Times are 24-hour in Cape Town (Africa/Johannesburg). Call get_plan before changing a day so you use real ids and avoid clashes. Confirm before deleting anything.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name || "");
      try {
        const out = await call(name, (msg.params?.arguments as Record<string, unknown>) || {});
        return ok({ content: [{ type: "text", text: JSON.stringify(out, null, 1) }], structuredContent: Array.isArray(out) ? { items: out } : out });
      } catch (e) {
        if (e instanceof ToolError) return ok({ content: [{ type: "text", text: e.message }], isError: true });
        return ok({ content: [{ type: "text", text: "The planner couldn't be reached. Try again in a moment." }], isError: true });
      }
    }
    default:
      return err(-32601, `Method not found: ${msg.method}`);
  }
}
