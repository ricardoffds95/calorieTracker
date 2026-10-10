import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { pt } from "date-fns/locale";
import { addDays, parseDateKey, toDateKey } from "./dates";
import type { MacroTotals } from "./macros";
import { roundCalories, roundMacro } from "./nutrition";

export type PeriodKind = "week" | "month" | "year" | "custom";
export const PERIOD_KINDS: readonly PeriodKind[] = ["week", "month", "year", "custom"];

/** A period of calendar days, both ends included, as `YYYY-MM-DD` keys (no time zones involved). */
export interface Period {
  kind: PeriodKind;
  from: string;
  to: string;
}

/** Same limit as the SQL function. */
export const MAX_RANGE_DAYS = 3660;

/** Totals of one day with entries (what `diary_daily_totals` returns). */
export interface DayTotals {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entries: number;
}

const WEEK = { weekStartsOn: 1 } as const; // Monday

function dateOf(key: string): Date {
  const date = parseDateKey(key);
  if (!date) throw new RangeError(`Invalid date key: ${key}`);
  return date;
}

/** Number of calendar days from `from` to `to`, both included. */
export function spanDays(from: string, to: string): number {
  return differenceInCalendarDays(dateOf(to), dateOf(from)) + 1;
}

/** The week (Monday to Sunday), month or year that contains `anchor`. */
export function periodFor(kind: Exclude<PeriodKind, "custom">, anchor: string): Period {
  const date = dateOf(anchor);
  switch (kind) {
    case "week":
      return { kind, from: toDateKey(startOfWeek(date, WEEK)), to: toDateKey(endOfWeek(date, WEEK)) };
    case "month":
      return { kind, from: toDateKey(startOfMonth(date)), to: toDateKey(endOfMonth(date)) };
    case "year":
      return { kind, from: toDateKey(startOfYear(date)), to: toDateKey(endOfYear(date)) };
  }
}

/** Message for an invalid custom range, or null when it is fine. */
export function validateRange(from: string, to: string): string | null {
  if (!parseDateKey(from) || !parseDateKey(to)) return "Indica as duas datas.";
  if (to < from) return "A data final tem de ser depois da inicial.";
  if (spanDays(from, to) > MAX_RANGE_DAYS) return "Máximo 10 anos.";
  return null;
}

/** Previous (-1) or next (+1) period of the same kind; a custom range moves by its own length. */
export function shiftPeriod(period: Period, direction: 1 | -1): Period {
  if (period.kind === "custom") {
    const length = spanDays(period.from, period.to);
    return { kind: "custom", from: addDays(period.from, direction * length), to: addDays(period.to, direction * length) };
  }
  const date = dateOf(period.from);
  const anchor =
    period.kind === "week" ? addDays(period.from, direction * 7) : toDateKey(period.kind === "month" ? addMonths(date, direction) : addYears(date, direction));
  return periodFor(period.kind, anchor);
}

export function containsDay(period: Period, key: string): boolean {
  return key >= period.from && key <= period.to;
}

/** Days of the period that have already started (the future does not count as "not logged"). */
export function elapsedDays(period: Period, todayKey: string): number {
  if (todayKey < period.from) return 0;
  return spanDays(period.from, todayKey < period.to ? todayKey : period.to);
}

interface ParamsLike {
  get(name: string): string | null;
}

/** The period from `?p=&d=&from=&to=`; anything invalid falls back to the current week. */
export function parsePeriodParams(params: ParamsLike, now: Date): Period {
  const fallback = periodFor("week", toDateKey(now));
  const kind = params.get("p");
  if (kind === "custom") {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    return validateRange(from, to) === null ? { kind: "custom", from, to } : fallback;
  }
  if (kind === "week" || kind === "month" || kind === "year") {
    const anchor = params.get("d");
    return parseDateKey(anchor) ? periodFor(kind, anchor as string) : periodFor(kind, toDateKey(now));
  }
  return fallback;
}

/** `/historico` for the current week, otherwise a URL that restores exactly this period. */
export function periodHref(period: Period, now: Date): string {
  if (period.kind === "week" && period.from === periodFor("week", toDateKey(now)).from) return "/historico";
  if (period.kind === "custom") return `/historico?p=custom&from=${period.from}&to=${period.to}`;
  return `/historico?p=${period.kind}&d=${period.from}`;
}

const day = (key: string) => format(dateOf(key), "d MMM", { locale: pt });
const withYear = (key: string) => format(dateOf(key), "d MMM yyyy", { locale: pt });

/** "5–11 out", "28 set – 4 out", "outubro 2026", "2026", "3 set – 20 out 2025" (weeks and ranges only show the year when it is not the current one). */
export function periodLabel(period: Period, now: Date): string {
  const thisYear = now.getFullYear();
  const from = dateOf(period.from);
  const to = dateOf(period.to);
  if (period.kind === "year") return String(from.getFullYear());
  if (period.kind === "month") return format(from, "MMMM yyyy", { locale: pt });
  const suffix = to.getFullYear() === thisYear && from.getFullYear() === thisYear ? "" : ` ${to.getFullYear()}`;
  if (from.getFullYear() !== to.getFullYear()) return `${withYear(period.from)} – ${withYear(period.to)}`;
  if (period.from === period.to) return `${day(period.from)}${suffix}`;
  const sameMonth = from.getMonth() === to.getMonth();
  return sameMonth ? `${from.getDate()}–${day(period.to)}${suffix}` : `${day(period.from)} – ${day(period.to)}${suffix}`;
}

export interface PeriodSummary {
  /** Days of the period that already started. */
  elapsedDays: number;
  loggedDays: number;
  total: MacroTotals;
  /** Per logged day (days without entries do not drag the average down); null when nothing was logged. */
  average: MacroTotals | null;
  highest: DayTotals | null;
  lowest: DayTotals | null;
}

const ZERO: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function sum(days: readonly DayTotals[]): MacroTotals {
  return days.reduce(
    (acc, d) => ({ calories: acc.calories + d.calories, protein: acc.protein + d.protein_g, carbs: acc.carbs + d.carbs_g, fat: acc.fat + d.fat_g }),
    ZERO,
  );
}

function averageOf(days: readonly DayTotals[]): MacroTotals | null {
  if (days.length === 0) return null;
  const total = sum(days);
  const n = days.length;
  return { calories: roundCalories(total.calories / n), protein: roundMacro(total.protein / n), carbs: roundMacro(total.carbs / n), fat: roundMacro(total.fat / n) };
}

export function summarize(days: readonly DayTotals[], period: Period, todayKey: string): PeriodSummary {
  const inPeriod = days.filter((d) => containsDay(period, d.date) && d.entries > 0);
  const total = sum(inPeriod);
  const byCalories = [...inPeriod].sort((a, b) => a.calories - b.calories);
  return {
    elapsedDays: elapsedDays(period, todayKey),
    loggedDays: inPeriod.length,
    total: { calories: roundCalories(total.calories), protein: roundMacro(total.protein), carbs: roundMacro(total.carbs), fat: roundMacro(total.fat) },
    average: averageOf(inPeriod),
    highest: byCalories.at(-1) ?? null,
    lowest: byCalories[0] ?? null,
  };
}

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

/** Percentage of the calories that come from each macro (4/4/9 kcal per gram), summing to exactly 100 (0 when nothing was eaten). */
export function macroSplit(avg: Pick<MacroTotals, "protein" | "carbs" | "fat">): MacroSplit {
  const parts = [avg.protein * 4, avg.carbs * 4, avg.fat * 9];
  const total = parts[0]! + parts[1]! + parts[2]!;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  const exact = parts.map((p) => (p / total) * 100);
  const floors = exact.map(Math.floor);
  // largest remainder method: hand the missing points to the biggest fractions
  let missing = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((value, i) => ({ i, rest: value - floors[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (missing <= 0) break;
    floors[i]! += 1;
    missing -= 1;
  }
  return { protein: floors[0]!, carbs: floors[1]!, fat: floors[2]! };
}

export type Granularity = "day" | "week" | "month";

export interface Bucket {
  key: string;
  granularity: Granularity;
  from: string;
  to: string;
  loggedDays: number;
  /** Average per logged day inside the bucket; null when nothing was logged. */
  average: MacroTotals | null;
}

/** Day bars up to a month, weeks up to ~6 months, months beyond that. */
export function granularityFor(period: Period): Granularity {
  const days = spanDays(period.from, period.to);
  if (days <= 31) return "day";
  return days <= 190 ? "week" : "month";
}

function boundsOf(granularity: Granularity, key: string): { from: string; to: string } {
  const date = dateOf(key);
  if (granularity === "week") return { from: toDateKey(startOfWeek(date, WEEK)), to: toDateKey(endOfWeek(date, WEEK)) };
  if (granularity === "month") return { from: toDateKey(startOfMonth(date)), to: toDateKey(endOfMonth(date)) };
  return { from: key, to: key };
}

/** Consecutive buckets covering the whole period (empty ones included, so the axis never has holes). */
export function bucketize(days: readonly DayTotals[], period: Period): Bucket[] {
  const granularity = granularityFor(period);
  const buckets: Bucket[] = [];
  let cursor = period.from;
  while (cursor <= period.to) {
    const bounds = boundsOf(granularity, cursor);
    const from = bounds.from < period.from ? period.from : bounds.from;
    const to = bounds.to > period.to ? period.to : bounds.to;
    const inside = days.filter((d) => d.date >= from && d.date <= to && d.entries > 0);
    buckets.push({ key: from, granularity, from, to, loggedDays: inside.length, average: averageOf(inside) });
    cursor = addDays(bounds.to, 1);
  }
  return buckets;
}

/** "ter, 6 out" */
export function dayLabel(key: string): string {
  return format(dateOf(key), "EEE, d MMM", { locale: pt });
}

/** Short name of a bucket for lists: "ter, 6 out", "5–11 out", "outubro". */
export function bucketLabel(bucket: Bucket): string {
  if (bucket.granularity === "day") return dayLabel(bucket.from);
  if (bucket.granularity === "month") return format(dateOf(bucket.from), "MMMM", { locale: pt });
  const from = dateOf(bucket.from);
  const to = dateOf(bucket.to);
  return from.getMonth() === to.getMonth() ? `${from.getDate()}–${day(bucket.to)}` : `${day(bucket.from)} – ${day(bucket.to)}`;
}

/** The x-axis text of a bar; empty for the bars that would crowd the axis. */
export function axisLabel(bucket: Bucket, index: number, total: number): string {
  const date = dateOf(bucket.from);
  if (bucket.granularity === "day") {
    if (total <= 7) return format(date, "EEEEE", { locale: pt }).toUpperCase();
    return index === 0 || date.getDate() % 5 === 0 ? String(date.getDate()) : "";
  }
  if (bucket.granularity === "month") return format(date, "MMMMM", { locale: pt }).toUpperCase();
  const step = Math.ceil(total / 6);
  return index % step === 0 ? format(date, "d MMM", { locale: pt }) : "";
}

/** Where tapping a bucket leads: a day opens in "Hoje", a week/month drills into that period. */
export function bucketHref(bucket: Bucket, now: Date): string {
  if (bucket.granularity === "day") return bucket.from === toDateKey(now) ? "/" : `/?d=${bucket.from}`;
  return periodHref(periodFor(bucket.granularity, bucket.from), now);
}
