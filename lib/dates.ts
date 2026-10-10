import { addDays as addDaysFns, differenceInCalendarDays, format, isValid, parse } from "date-fns";
import { pt } from "date-fns/locale";

const KEY_FORMAT = "yyyy-MM-dd";

/** Local calendar day as `YYYY-MM-DD` (the format stored in `diary_entries.entry_date`). */
export function toDateKey(date: Date): string {
  return format(date, KEY_FORMAT);
}

/** Parses a `YYYY-MM-DD` key into a local date at noon; null if it is not a real calendar day. */
export function parseDateKey(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = parse(key, KEY_FORMAT, new Date(2000, 0, 1, 12));
  return isValid(date) && format(date, KEY_FORMAT) === key ? date : null;
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  if (!date) throw new RangeError(`Invalid date key: ${key}`);
  return toDateKey(addDaysFns(date, days));
}

export function isToday(key: string, now: Date): boolean {
  return key === toDateKey(now);
}

/** "Hoje, 10 out" / "Ontem, 9 out" / "Amanhã, 11 out" / "sáb, 3 out". */
export function formatDayLabel(key: string, now: Date): string {
  const date = parseDateKey(key);
  if (!date) return key;
  const diff = differenceInCalendarDays(date, now);
  const short = format(date, "d MMM", { locale: pt });
  if (diff === 0) return `Hoje, ${short}`;
  if (diff === -1) return `Ontem, ${short}`;
  if (diff === 1) return `Amanhã, ${short}`;
  return `${format(date, "EEE", { locale: pt })}, ${short}`;
}

/** A valid key from user input (e.g. the `?d=` param), or today's key. */
export function dateKeyOrToday(input: string | null | undefined, now: Date): string {
  return parseDateKey(input) ? (input as string) : toDateKey(now);
}
