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
import { enGB } from "date-fns/locale";
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
  if (!parseDateKey(from) || !parseDateKey(to)) return "Both dates required";
  if (to < from) return "End date must be after the start";
  if (spanDays(from, to) > MAX_RANGE_DAYS) return "Max 10 years";
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

/** `/history` for the current week, otherwise a URL that restores exactly this period. */
export function periodHref(period: Period, now: Date): string {
  if (period.kind === "week" && period.from === periodFor("week", toDateKey(now)).from) return "/history";
  if (period.kind === "custom") return `/history?p=custom&from=${period.from}&to=${period.to}`;
  return `/history?p=${period.kind}&d=${period.from}`;
}

const day = (key: string) => format(dateOf(key), "d MMM", { locale: enGB });
const withYear = (key: string) => format(dateOf(key), "d MMM yyyy", { locale: enGB });

/** "5–11 out", "28 set – 4 out", "outubro 2026", "2026", "3 set – 20 out 2025" (weeks and ranges only show the year when it is not the current one). */
export function periodLabel(period: Period, now: Date): string {
  const thisYear = now.getFullYear();
  const from = dateOf(period.from);
  const to = dateOf(period.to);
  if (period.kind === "year") return String(from.getFullYear());
  if (period.kind === "month") return format(from, "MMMM yyyy", { locale: enGB });
  const suffix = to.getFullYear() === thisYear && from.getFullYear() === thisYear ? "" : ` ${to.getFullYear()}`;
  if (from.getFullYear() !== to.getFullYear()) return `${withYear(period.from)} – ${withYear(period.to)}`;
  if (period.from === period.to) return `${day(period.from)}${suffix}`;
  const sameMonth = from.getMonth() === to.getMonth();
  return sameMonth ? `${from.getDate()}–${day(period.to)}${suffix}` : `${day(period.from)} – ${day(period.to)}${suffix}`;
}

export type Metric = "calories" | "protein" | "carbs" | "fat";

/** The four things the History shows, in order, with their unit. */
export const METRICS: readonly { key: Metric; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

const DAY_FIELD: Record<Metric, "calories" | "protein_g" | "carbs_g" | "fat_g"> = {
  calories: "calories",
  protein: "protein_g",
  carbs: "carbs_g",
  fat: "fat_g",
};

/** A value on a given day (the highest or the lowest of the period). */
export interface DayValue {
  date: string;
  value: number;
}

/** Average per logged day, and the highest and lowest finished day, of one metric. */
export interface MetricStats {
  average: number;
  /** Null when the only logged day is today (it is not over yet). */
  max: DayValue | null;
  min: DayValue | null;
}

export interface PeriodSummary {
  /** Days of the period that already started. */
  elapsedDays: number;
  loggedDays: number;
  total: MacroTotals;
  /** Per logged day (days without entries do not drag the average down); null when nothing was logged. */
  average: MacroTotals | null;
  /** Average, highest and lowest day for each metric; null when nothing was logged. */
  stats: Record<Metric, MetricStats> | null;
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

/**
 * Average per logged day, and the highest and lowest day (the earliest one on a tie) of every metric.
 * Today is left out of the highest and lowest: it is not over, so it would nearly always be the lowest.
 */
function statsOf(days: readonly DayTotals[], average: MacroTotals, todayKey: string): Record<Metric, MetricStats> {
  const ordered = days.filter((d) => d.date !== todayKey).sort((a, b) => a.date.localeCompare(b.date));
  const stats = {} as Record<Metric, MetricStats>;
  for (const { key } of METRICS) {
    const field = DAY_FIELD[key];
    let max = ordered[0];
    let min = ordered[0];
    for (const day of ordered) {
      if (day[field] > max![field]) max = day;
      if (day[field] < min![field]) min = day;
    }
    stats[key] = {
      average: average[key],
      max: max ? { date: max.date, value: max[field] } : null,
      min: min ? { date: min.date, value: min[field] } : null,
    };
  }
  return stats;
}

export function summarize(days: readonly DayTotals[], period: Period, todayKey: string): PeriodSummary {
  const inPeriod = days.filter((d) => containsDay(period, d.date) && d.entries > 0);
  const total = sum(inPeriod);
  const average = averageOf(inPeriod);
  return {
    elapsedDays: elapsedDays(period, todayKey),
    loggedDays: inPeriod.length,
    total: { calories: roundCalories(total.calories), protein: roundMacro(total.protein), carbs: roundMacro(total.carbs), fat: roundMacro(total.fat) },
    average,
    stats: average ? statsOf(inPeriod, average, todayKey) : null,
  };
}

/** The average of a metric inside a bucket, or null when nothing was logged there. */
export function valueOf(bucket: Pick<Bucket, "average">, metric: Metric): number | null {
  return bucket.average ? bucket.average[metric] : null;
}

const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** The smallest round number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × a power of ten) that is at least `value`: a clean top for an axis. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 10;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const mantissa = value / exponent;
  return (NICE.find((n) => n >= mantissa - 1e-9) ?? 10) * exponent;
}

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
}

/** Whole percentages of `parts` that add up to exactly 100 (largest remainder method); all 0 when there is nothing. */
export function wholePercents(parts: readonly number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return parts.map(() => 0);
  const exact = parts.map((p) => (p / total) * 100);
  const floors = exact.map(Math.floor);
  // hand the missing points to the biggest fractions
  let missing = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((value, i) => ({ i, rest: value - floors[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (missing <= 0) break;
    floors[i]! += 1;
    missing -= 1;
  }
  return floors;
}

/** Percentage of the calories that come from each macro (4/4/9 kcal per gram), summing to exactly 100 (0 when nothing was eaten). */
export function macroSplit(avg: Pick<MacroTotals, "protein" | "carbs" | "fat">): MacroSplit {
  const [protein, carbs, fat] = wholePercents([avg.protein * 4, avg.carbs * 4, avg.fat * 9]);
  return { protein: protein!, carbs: carbs!, fat: fat! };
}

/** Whole-number change from `previous` to `current` in percent; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || !(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** The period right before this one, of the same length (last week, the previous month or year, the same number of days for a range). */
export function previousPeriod(period: Period): Period {
  return shiftPeriod(period, -1);
}

export type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
export const MEAL_ORDER: readonly MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

export interface MealShare {
  meal: MealKey;
  /** Whole percent of the period's calories, the four add up to 100 (0 when nothing was eaten). */
  percent: number;
  /** Average kcal of this meal per logged day. */
  perDay: number;
}

/** How the calories of a period split between the four meals, in the order of the day (meals without entries count 0). */
export function mealShares(rows: readonly { meal: string; calories: number }[], loggedDays: number): MealShare[] {
  const calories = MEAL_ORDER.map((meal) => rows.filter((r) => r.meal === meal).reduce((sum, r) => sum + r.calories, 0));
  const percents = wholePercents(calories);
  return MEAL_ORDER.map((meal, i) => ({ meal, percent: percents[i]!, perDay: loggedDays > 0 ? roundCalories(calories[i]! / loggedDays) : 0 }));
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

/**
 * Consecutive buckets covering the period (empty ones included, so the axis never has holes).
 * With `todayKey`, days that have not happened yet are left out: the current month ends today, not on the 31st.
 */
export function bucketize(days: readonly DayTotals[], period: Period, todayKey?: string): Bucket[] {
  const granularity = granularityFor(period);
  const end = todayKey !== undefined && todayKey < period.to ? todayKey : period.to;
  const buckets: Bucket[] = [];
  let cursor = period.from;
  while (cursor <= end) {
    const bounds = boundsOf(granularity, cursor);
    const from = bounds.from < period.from ? period.from : bounds.from;
    const to = bounds.to > end ? end : bounds.to;
    const inside = days.filter((d) => d.date >= from && d.date <= to && d.entries > 0);
    buckets.push({ key: from, granularity, from, to, loggedDays: inside.length, average: averageOf(inside) });
    cursor = addDays(bounds.to, 1);
  }
  return buckets;
}

/** "ter, 6 out" */
export function dayLabel(key: string): string {
  return format(dateOf(key), "EEE, d MMM", { locale: enGB });
}

/** Short name of a bucket for lists: "ter, 6 out", "5–11 out", "outubro". */
export function bucketLabel(bucket: Bucket): string {
  if (bucket.granularity === "day") return dayLabel(bucket.from);
  if (bucket.granularity === "month") return format(dateOf(bucket.from), "MMMM", { locale: enGB });
  const from = dateOf(bucket.from);
  const to = dateOf(bucket.to);
  return from.getMonth() === to.getMonth() ? `${from.getDate()}–${day(bucket.to)}` : `${day(bucket.from)} – ${day(bucket.to)}`;
}

/** The x-axis text of a bar; empty for the bars that would crowd the axis. */
export function axisLabel(bucket: Bucket, index: number, total: number, kind: PeriodKind): string {
  const date = dateOf(bucket.from);
  if (bucket.granularity === "day") {
    // weekday initials for a week (or a short range); the first days of a month still get day numbers
    if (total <= 7 && kind !== "month") return format(date, "EEEEE", { locale: enGB }).toUpperCase();
    return index === 0 || date.getDate() % 5 === 0 ? String(date.getDate()) : "";
  }
  if (bucket.granularity === "month") return format(date, "MMMMM", { locale: enGB }).toUpperCase();
  const step = Math.ceil(total / 6);
  return index % step === 0 ? format(date, "d MMM", { locale: enGB }) : "";
}

/** Where tapping a bucket leads: a day opens in "Today", a week/month drills into that period. */
export function bucketHref(bucket: Bucket, now: Date): string {
  if (bucket.granularity === "day") return bucket.from === toDateKey(now) ? "/" : `/?d=${bucket.from}`;
  return periodHref(periodFor(bucket.granularity, bucket.from), now);
}
