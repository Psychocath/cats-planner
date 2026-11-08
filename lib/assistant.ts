// "Tell the planner": Gemini reads a plain sentence and proposes planner changes.
// Nothing is saved here. The app shows each change on a confirm card and only applies the ones Cat keeps.
import { TOOLS, call } from "./mcp";
import { loadData, type Item } from "./store";
import { localNow } from "./schedule";

// Tools Gemini may propose. Reading tools are left out: the plan is sent with the request instead.
export const WRITE_TOOLS = ["add_block", "add_task", "add_routine", "update_item", "complete_task", "skip_routine", "delete_item"];
// gemini-3.8-flash is the current free Flash model; Flash-Lite answers faster and is the backup.
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(Boolean) as string[];
const DAYN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Action = { name: string; args: Record<string, unknown>; summary: string; detail?: string; danger?: boolean };

// Gemini's schema subset wants every object to list its properties, so update_item's free-form fields get spelled out.
const FIELD_PROPS = {
  title: { type: "string" },
  date: { type: "string", description: "YYYY-MM-DD" },
  start: { type: "string", description: "HH:MM" },
  end: { type: "string", description: "HH:MM" },
  kind: { type: "string", enum: ["work", "family", "admin", "me"] },
  location: { type: "string", description: "Address or place name. Empty string to clear." },
  notes: { type: "string" },
  priority: { type: "string", enum: ["top", "normal"] },
  mins: { type: "integer" },
  for: { type: "string", description: "Event date a task prepares for, YYYY-MM-DD" },
  days: { type: "array", items: { type: "integer" }, description: "Routines: 1=Mon … 7=Sun" },
  until: { type: "string", description: "Routines: last date YYYY-MM-DD" },
  remind: { type: "integer", description: "Minutes before the start. -1 for none." },
};
function declarations() {
  return TOOLS.filter((t) => WRITE_TOOLS.includes(t.name)).map((t) => {
    const params = JSON.parse(JSON.stringify(t.inputSchema));
    if (t.name === "update_item") params.properties.fields = { type: "object", description: "Only the fields that change.", properties: FIELD_PROPS };
    return { name: t.name, description: t.description, parameters: params };
  });
}

const dLabel = (ds: unknown) => {
  const s = String(ds || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map(Number);
  const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${DAYN[wd]} ${d} ${MON[m - 1]}`;
};
const span = (a: Record<string, unknown>) => (a.start && a.end ? `${a.start} to ${a.end}` : "");
const join = (...p: unknown[]) => p.filter(Boolean).join(", ");

function describe(name: string, a: Record<string, unknown>, find: (col: string, id: unknown) => Item | undefined): Action {
  const base = { name, args: a };
  switch (name) {
    case "add_block":
      return { ...base, summary: `Add ${a.title}`, detail: join(dLabel(a.date), span(a), a.location) };
    case "add_task":
      return { ...base, summary: `Add task: ${a.title}`, detail: join(a.date ? `Do by ${dLabel(a.date)}` : "Inbox", a.priority === "top" && "Top 3", a.for && `For ${dLabel(a.for)}`) };
    case "add_routine":
      return { ...base, summary: `Add routine: ${a.title}`, detail: join(((a.days as number[]) || []).map((n) => DAYN[n - 1]).join(" "), span(a), a.location) };
    case "update_item": {
      const it = find(String(a.collection), a.id), f = (a.fields || {}) as Record<string, unknown>;
      const was = it ? join(it.date && dLabel(it.date), span(it)) : "";
      const moved = f.start !== undefined || f.end !== undefined;
      const now = join(f.title && `"${f.title}"`, f.date && dLabel(f.date), moved && span({ start: f.start ?? it?.start, end: f.end ?? it?.end }), f.location !== undefined && (f.location ? `at ${f.location}` : "no location"), f.priority === "top" && "Top 3", f.notes && "new notes");
      return { ...base, summary: `Change ${it ? it.title : "an item"}`, detail: was && now ? `${was} → ${now}` : now || was };
    }
    case "complete_task": {
      const it = find("tasks", a.id);
      return { ...base, summary: `${a.done === false ? "Untick" : "Tick off"} ${it ? it.title : "a task"}` };
    }
    case "skip_routine": {
      const it = find("routines", a.id);
      return { ...base, summary: `${a.undo ? "Bring back" : "Skip"} ${it ? it.title : "a routine"}`, detail: dLabel(a.date) };
    }
    case "delete_item": {
      const it = find(String(a.collection), a.id);
      return { ...base, summary: `Delete ${it ? it.title : "an item"}`, detail: it ? join(it.date && dLabel(it.date), span(it)) : "", danger: true };
    }
  }
  return { ...base, summary: name };
}

function rules(today: string, now: string) {
  return `You update Cat's day planner from what she types or dictates. She lives in Cape Town; all times are 24-hour local time.
Today is ${dLabel(today)} (${today}) and the time is ${now}.

How to answer:
- Turn her message into planner tool calls. Use several calls when she asks for several changes.
- Use ids exactly as they appear in the plan below. Never invent an id. If you can't tell which item she means, make no call and ask a short question.
- "Tomorrow", "Thursday", "next week" mean dates relative to today. A weekday with no week means the next one coming.
- If she gives a start but no end, make blocks 1 hour long.
- When she asks to move or update a task or block, it hasn't been done yet: move it to the next free slot from now that fits, without clashing with what's already planned.
- Prep tasks name the date they are for in the title, e.g. "Choose a pre-loved toy for Leo to donate for Fri 4 Dec", and set "for" to that date.
- Pick the kind that fits: work, family (kids, school, home life), admin (errands, bills, appointments), me (rest, exercise, hobbies).
- Put a place or address she mentions in location.
- Only delete when she clearly asks for it.
- Along with the calls, write one short plain sentence saying what you've set up. No emoji, no em dashes.`;
}

type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; thought?: boolean };

async function gemini(body: unknown): Promise<Part[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("The Gemini key isn't set up yet. Add GEMINI_API_KEY in Vercel.");
  let last = "";
  const started = Date.now();
  for (const model of MODELS) {
    const left = 50000 - (Date.now() - started);
    if (left < 8000) break;
    // Keep thinking short: this is a quick scheduling job, and long thinking ran past the time limit.
    const thinking = { thinkingLevel: "minimal" };
    const b = body as Record<string, unknown>;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(left - 1000, 28000));
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ ...b, generationConfig: { ...(b.generationConfig as object), thinkingConfig: thinking } }),
        signal: ctrl.signal,
      });
    } catch {
      console.error(`Gemini ${model} timed out after ${Date.now() - started} ms`);
      last = "timeout";
      continue;
    } finally {
      clearTimeout(timer);
    }
    console.log(`Gemini ${model} answered ${r.status} after ${Date.now() - started} ms`);
    if (r.ok) {
      const j = await r.json();
      return (j.candidates?.[0]?.content?.parts as Part[]) || [];
    }
    last = await r.text().catch(() => "");
    console.error(`Gemini ${model} error`, last.slice(0, 400));
    if (r.status === 429) throw new Error("Gemini's free limit is used up for now. Try again in a minute.");
    if (/API key/i.test(last)) throw new Error("Gemini didn't accept the key. Check GEMINI_API_KEY in Vercel.");
    if (r.status !== 404 && r.status !== 400) break; // only a missing model or an unsupported setting is worth trying the next one
  }
  if (last === "timeout") throw new Error("Gemini took too long to answer. Try again, or say it in fewer words.");
  console.error("Gemini error", last.slice(0, 500));
  throw new Error("The planner assistant couldn't be reached. Try again in a moment.");
}

export async function propose(text: string): Promise<{ reply: string; actions: Action[] }> {
  const now = localNow();
  const time = `${String(Math.floor(now.minute / 60)).padStart(2, "0")}:${String(now.minute % 60).padStart(2, "0")}`;
  const [plan, tasks, d] = await Promise.all([call("get_plan", { date: now.date, days: 8 }), call("list_tasks", {}), loadData()]);
  const parts = await gemini({
    systemInstruction: { parts: [{ text: rules(now.date, time) }] },
    contents: [{ role: "user", parts: [{ text: `My plan for the next 8 days:\n${JSON.stringify(plan)}\n\nMy open tasks:\n${JSON.stringify(tasks)}\n\nMy message: ${text}` }] }],
    tools: [{ functionDeclarations: declarations() }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { temperature: 0.2 },
  });
  const find = (col: string, id: unknown) => ((d as unknown as Record<string, Item[]>)[col] || []).find((x) => x.id === id);
  const actions = parts
    .filter((p) => p.functionCall && WRITE_TOOLS.includes(p.functionCall.name))
    .slice(0, 12)
    .map((p) => describe(p.functionCall!.name, p.functionCall!.args || {}, find));
  const reply = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join(" ").replace(/\s*—\s*/g, ", ").trim();
  return { reply: reply || (actions.length ? "Here's what I'd change." : "I couldn't work out a change from that. Try saying what, when and for how long."), actions };
}

export async function apply(actions: { name: string; args: Record<string, unknown> }[]) {
  const done: { name: string; ok: boolean; error?: string }[] = [];
  for (const a of actions.slice(0, 12)) {
    if (!WRITE_TOOLS.includes(a.name)) { done.push({ name: a.name, ok: false, error: "Not allowed." }); continue; }
    try {
      await call(a.name, a.args || {});
      done.push({ name: a.name, ok: true });
    } catch (e) {
      done.push({ name: a.name, ok: false, error: e instanceof Error ? e.message : "That change couldn't be saved." });
    }
  }
  return done;
}
