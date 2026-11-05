// A small MCP server (Streamable HTTP, stateless, JSON responses) so Claude can read and change the planner.
import { loadData, updateData, type Collection, type Data, type Item } from "./store";
import { itemsFor, localNow, toMin } from "./schedule";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["work", "family", "admin", "me"];
const COLS: Collection[] = ["tasks", "blocks", "routines"];
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

class ToolError extends Error {}
const need = (ok: unknown, msg: string) => {
  if (!ok) throw new ToolError(msg);
};
const checkTimes = (start: unknown, end: unknown) => {
  need(TIME.test(String(start)) && TIME.test(String(end)), "Use 24-hour times like 09:30.");
  need(toMin(String(end)) > toMin(String(start)), "The end time must be after the start time.");
};
const extras = (a: Record<string, unknown>) => {
  const o: Record<string, unknown> = {};
  if (typeof a.remind === "number") o.remind = Math.max(-1, Math.min(10080, Math.round(a.remind)));
  if (a.notes) o.notes = String(a.notes).slice(0, 2000);
  return o;
};
const kindOf = (k: unknown) => (KINDS.includes(String(k)) ? String(k) : "work");

const str = (description: string) => ({ type: "string", description });
const TOOLS = [
  {
    name: "get_plan",
    description:
      "Read the planner for one or more days: time blocks and routines (with ids), tasks due, Top 3, and free time in the work day. Dates are in Cape Town time.",
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
    description: "Add a one-off time block on a date.",
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
        notes: str("Extra details (optional)."),
      },
    },
  },
  {
    name: "add_task",
    description: "Add a task. Leave date empty to put it in the Inbox. priority 'top' puts it in that day's Top 3 (max 3 per day).",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: str("The task."),
        date: str("Due date, YYYY-MM-DD (optional)."),
        priority: { type: "string", enum: ["top", "normal"] },
        mins: { type: "integer", minimum: 5, description: "Estimated minutes (optional)." },
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
        notes: str("Extra details (optional)."),
      },
    },
  },
  {
    name: "update_item",
    description: "Change fields on an existing block, task or routine. Only the fields you pass change.",
    inputSchema: {
      type: "object",
      required: ["collection", "id", "fields"],
      properties: {
        collection: { type: "string", enum: COLS },
        id: str("Item id from get_plan or list_tasks."),
        fields: { type: "object", description: "e.g. {title, date, start, end, kind, notes, remind (minutes before; -1 none; null for default), priority, mins, done, days}" },
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
    description: "Delete a block, task or routine for good. Confirm with the person first.",
    inputSchema: { type: "object", required: ["collection", "id"], properties: { collection: { type: "string", enum: COLS }, id: str("Item id.") } },
  },
  {
    name: "update_settings",
    description: "Change work hours or how many minutes before a block the phone alert fires.",
    inputSchema: {
      type: "object",
      properties: { workStart: str("HH:MM"), workEnd: str("HH:MM"), leadMin: { type: "integer", minimum: 0, maximum: 60 } },
    },
  },
];

function freeWork(d: Data, date: string) {
  const ws = toMin(d.settings.workStart), we = toMin(d.settings.workEnd);
  const spans = itemsFor(d, date, wdOf(date)).map((i) => [toMin(i.start), toMin(i.end)]).sort((a, b) => a[0] - b[0]);
  let busy = 0, cur: number[] | null = null;
  const flush = () => cur && (busy += Math.max(0, Math.min(cur[1], we) - Math.max(cur[0], ws)));
  for (const s of spans) {
    if (cur && s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else { flush(); cur = [...s]; }
  }
  flush();
  return Math.max(0, we - ws - busy);
}

const pick = (i: Item, keys: string[]) => Object.fromEntries(keys.filter((k) => i[k] !== undefined && i[k] !== null).map((k) => [k, i[k]]));

async function call(name: string, a: Record<string, unknown>) {
  const now = localNow();
  switch (name) {
    case "get_plan": {
      const d = await loadData();
      const start = a.date ? String(a.date) : now.date;
      need(DATE.test(start), "Use dates like 2026-11-06.");
      const n = Math.min(14, Math.max(1, Number(a.days) || 1));
      const days = [];
      for (let k = 0; k < n; k++) {
        const date = addDays(start, k), wd = wdOf(date);
        const blocks = d.blocks.filter((b) => b.date === date).map((b) => ({ ...pick(b, ["id", "title", "start", "end", "kind", "remind", "notes"]), type: "block" }));
        const routines = d.routines
          .filter((r) => ((r.days as number[]) || []).includes(wd) && !((r.skips as string[]) || []).includes(date))
          .map((r) => ({ ...pick(r, ["id", "title", "start", "end", "kind", "remind", "notes"]), type: "routine" }));
        const tasks = d.tasks.filter((t) => t.date === date).map((t) => pick(t, ["id", "title", "priority", "mins", "done"]));
        days.push({
          date,
          weekday: DAYN[wd - 1],
          schedule: ([...blocks, ...routines] as Record<string, unknown>[]).sort((x, y) => toMin(String(x.start)) - toMin(String(y.start))),
          tasks,
          free_work_minutes: wd <= 5 ? freeWork(d, date) : null,
        });
      }
      return { today: now.date, now: `${String(Math.floor(now.minute / 60)).padStart(2, "0")}:${String(now.minute % 60).padStart(2, "0")}`, settings: d.settings, days };
    }
    case "list_tasks": {
      const d = await loadData();
      return d.tasks.filter((t) => a.include_done || !t.done).map((t) => pick(t, ["id", "title", "date", "priority", "mins", "done"]));
    }
    case "add_block": {
      need(String(a.title || "").trim(), "Give the block a title.");
      need(DATE.test(String(a.date)), "Use dates like 2026-11-06.");
      checkTimes(a.start, a.end);
      const rec: Item = { id: uid(), title: String(a.title).trim(), date: String(a.date), start: String(a.start), end: String(a.end), kind: kindOf(a.kind), ...extras(a) };
      await updateData((d) => void d.blocks.push(rec));
      return { added: rec };
    }
    case "add_task": {
      need(String(a.title || "").trim(), "Give the task a title.");
      const date = a.date ? String(a.date) : null;
      need(!date || DATE.test(date), "Use dates like 2026-11-06.");
      const priority = a.priority === "top" ? "top" : "normal";
      const rec = { id: uid(), title: String(a.title).trim(), date, priority, mins: Number(a.mins) || null, done: false, createdAt: Date.now() };
      await updateData((d) => {
        if (priority === "top" && date) {
          need(d.tasks.filter((t) => t.date === date && t.priority === "top" && !t.done).length < 3, "That day already has 3 Top tasks.");
        }
        d.tasks.push(rec);
      });
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
      need(COLS.includes(col), "collection must be tasks, blocks or routines.");
      const f = (a.fields || {}) as Record<string, unknown>;
      delete f.id;
      return updateData((d) => {
        const i = d[col].findIndex((x) => x.id === a.id);
        need(i >= 0, "No item with that id. Use get_plan or list_tasks to find it.");
        const next = { ...d[col][i], ...f };
        if (col !== "tasks") checkTimes(next.start, next.end);
        if (next.date) need(DATE.test(String(next.date)), "Use dates like 2026-11-06.");
        if (f.kind !== undefined) next.kind = kindOf(f.kind);
        if (f.remind === null) delete next.remind;
        else if (f.remind !== undefined) next.remind = Math.max(-1, Math.min(10080, Math.round(Number(f.remind))));
        delete next.example;
        d[col][i] = next as Item;
        return { updated: next };
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
      need(COLS.includes(col), "collection must be tasks, blocks or routines.");
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
