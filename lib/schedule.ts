import type { Data, Item } from "./store";

export const TZ = "Africa/Johannesburg";
export const toMin = (t: string) => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return h * 60 + m;
};

/** Current date (YYYY-MM-DD), minute of day and weekday (Mon=1..Sun=7) in Cape Town. */
export function localNow(at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute), wd };
}

export type Planned = { key: string; title: string; start: string; end: string; routine: boolean };

export function itemsFor(d: Data, date: string, wd: number): Planned[] {
  const blocks = d.blocks
    .filter((b) => b.date === date)
    .map((b: Item) => ({ key: `${date}|b:${b.id}|${b.start}`, title: String(b.title), start: String(b.start), end: String(b.end), routine: false }));
  const routines = d.routines
    .filter((r) => ((r.days as number[]) || []).includes(wd) && !((r.skips as string[]) || []).includes(date))
    .map((r: Item) => ({ key: `${date}|r:${r.id}|${r.start}`, title: String(r.title), start: String(r.start), end: String(r.end), routine: true }));
  return [...blocks, ...routines].sort((a, b) => toMin(a.start) - toMin(b.start));
}
