import { describe, expect, it } from "vitest";
import {
  axisLabel,
  bucketHref,
  bucketLabel,
  bucketize,
  containsDay,
  elapsedDays,
  granularityFor,
  macroSplit,
  mealShares,
  niceMax,
  percentChange,
  previousPeriod,
  wholePercents,
  valueOf,
  parsePeriodParams,
  periodFor,
  periodHref,
  periodLabel,
  shiftPeriod,
  spanDays,
  summarize,
  summarizeTraining,
  trainingBuckets,
  validateRange,
  type DayTotals,
  type Period,
} from "./history";

const now = new Date(2026, 9, 10, 15, 30); // Saturday 10 Oct 2026
const day = (date: string, calories: number, protein_g = 0, carbs_g = 0, fat_g = 0, entries = 1): DayTotals => ({
  date,
  calories,
  protein_g,
  carbs_g,
  fat_g,
  entries,
});
const custom = (from: string, to: string): Period => ({ kind: "custom", from, to });

describe("periodFor", () => {
  it("weeks run Monday to Sunday", () => {
    expect(periodFor("week", "2026-10-10")).toEqual({ kind: "week", from: "2026-10-05", to: "2026-10-11" });
    expect(periodFor("week", "2026-10-05")).toMatchObject({ from: "2026-10-05", to: "2026-10-11" }); // Monday
    expect(periodFor("week", "2026-10-11")).toMatchObject({ from: "2026-10-05", to: "2026-10-11" }); // Sunday
  });
  it("a week can span two months or two years", () => {
    expect(periodFor("week", "2026-10-01")).toMatchObject({ from: "2026-09-28", to: "2026-10-04" });
    expect(periodFor("week", "2026-01-01")).toMatchObject({ from: "2025-12-29", to: "2026-01-04" });
  });
  it("covers the whole month, including leap Februarys, and the whole year", () => {
    expect(periodFor("month", "2026-10-17")).toEqual({ kind: "month", from: "2026-10-01", to: "2026-10-31" });
    expect(periodFor("month", "2028-02-10").to).toBe("2028-02-29");
    expect(periodFor("month", "2027-02-10").to).toBe("2027-02-28");
    expect(periodFor("year", "2026-06-15")).toEqual({ kind: "year", from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("shiftPeriod", () => {
  it("moves weeks by 7 days across the year boundary", () => {
    expect(shiftPeriod(periodFor("week", "2026-01-01"), 1)).toMatchObject({ from: "2026-01-05", to: "2026-01-11" });
    expect(shiftPeriod(periodFor("week", "2026-01-01"), -1)).toMatchObject({ from: "2025-12-22", to: "2025-12-28" });
  });
  it("moves months and years, keeping their real length", () => {
    expect(shiftPeriod(periodFor("month", "2026-01-15"), -1)).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(shiftPeriod(periodFor("month", "2026-01-31"), 1)).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(shiftPeriod(periodFor("year", "2026-03-01"), 1)).toMatchObject({ from: "2027-01-01", to: "2027-12-31" });
  });
  it("moves a custom range by its own length", () => {
    expect(shiftPeriod(custom("2026-10-01", "2026-10-10"), 1)).toEqual(custom("2026-10-11", "2026-10-20"));
    expect(shiftPeriod(custom("2026-10-01", "2026-10-10"), -1)).toEqual(custom("2026-09-21", "2026-09-30"));
  });
});

describe("validateRange", () => {
  it("accepts a valid range, including a single day", () => {
    expect(validateRange("2026-10-01", "2026-10-10")).toBeNull();
    expect(validateRange("2026-10-01", "2026-10-01")).toBeNull();
  });
  it("explains what is wrong", () => {
    expect(validateRange("", "2026-10-10")).toBe("Both dates required");
    expect(validateRange("2026-02-30", "2026-03-10")).toBe("Both dates required");
    expect(validateRange("2026-10-10", "2026-10-01")).toBe("End date must be after the start");
    expect(validateRange("2010-01-01", "2026-10-10")).toBe("Max 10 years");
  });
  it("allows exactly the maximum and rejects one more day", () => {
    expect(validateRange("2016-01-01", "2025-12-31")).toBeNull(); // 3653 days
    expect(validateRange("2016-01-01", "2026-01-08")).toBe("Max 10 years"); // 3661 days
  });
});

describe("parsePeriodParams / periodHref", () => {
  const params = (query: string) => new URLSearchParams(query);
  const currentWeek = periodFor("week", "2026-10-10");

  it("defaults to the current week", () => {
    expect(parsePeriodParams(params(""), now)).toEqual(currentWeek);
  });
  it("reads week, month, year and custom", () => {
    expect(parsePeriodParams(params("p=month&d=2026-09-01"), now)).toEqual(periodFor("month", "2026-09-01"));
    expect(parsePeriodParams(params("p=year&d=2025-05-05"), now)).toEqual(periodFor("year", "2025-05-05"));
    expect(parsePeriodParams(params("p=month"), now)).toEqual(periodFor("month", "2026-10-10")); // no date: the current one
    expect(parsePeriodParams(params("p=custom&from=2026-10-01&to=2026-10-10"), now)).toEqual(custom("2026-10-01", "2026-10-10"));
  });
  it("falls back to the current week for anything invalid", () => {
    for (const query of ["p=decade", "p=custom&from=2026-10-10&to=2026-10-01", "p=custom&from=x&to=y", "p=custom", "p=week&d=nope"]) {
      expect(parsePeriodParams(params(query), now), query).toEqual(currentWeek);
    }
  });
  it("builds URLs that restore the same period", () => {
    expect(periodHref(currentWeek, now)).toBe("/history");
    for (const period of [periodFor("week", "2026-09-01"), periodFor("month", "2026-09-01"), periodFor("year", "2025-01-01"), custom("2026-10-01", "2026-10-10")]) {
      const url = new URL(periodHref(period, now), "http://localhost");
      expect(parsePeriodParams(url.searchParams, now)).toEqual(period);
    }
  });
});

describe("periodLabel", () => {
  it("is short and only shows the year when it is not the current one", () => {
    expect(periodLabel(periodFor("week", "2026-10-10"), now)).toBe("5–11 Oct");
    expect(periodLabel(periodFor("week", "2026-10-01"), now)).toBe("28 Sep – 4 Oct");
    expect(periodLabel(periodFor("week", "2025-10-10"), now)).toBe("6–12 Oct 2025");
    expect(periodLabel(periodFor("month", "2026-10-10"), now)).toBe("October 2026");
    expect(periodLabel(periodFor("year", "2026-10-10"), now)).toBe("2026");
    expect(periodLabel(custom("2026-09-03", "2026-10-20"), now)).toBe("3 Sep – 20 Oct");
    expect(periodLabel(custom("2025-09-03", "2025-10-20"), now)).toBe("3 Sep – 20 Oct 2025");
    expect(periodLabel(custom("2025-12-29", "2026-01-04"), now)).toBe("29 Dec 2025 – 4 Jan 2026");
    expect(periodLabel(custom("2026-10-10", "2026-10-10"), now)).toBe("10 Oct");
  });
});

describe("containsDay / elapsedDays / spanDays", () => {
  const week = periodFor("week", "2026-10-10");
  it("includes both ends", () => {
    expect(containsDay(week, "2026-10-05")).toBe(true);
    expect(containsDay(week, "2026-10-11")).toBe(true);
    expect(containsDay(week, "2026-10-12")).toBe(false);
    expect(spanDays("2026-10-05", "2026-10-11")).toBe(7);
  });
  it("only counts the days that have already started", () => {
    expect(elapsedDays(week, "2026-10-07")).toBe(3);
    expect(elapsedDays(week, "2026-10-20")).toBe(7);
    expect(elapsedDays(week, "2026-10-01")).toBe(0);
  });
});

describe("summarize", () => {
  const week = periodFor("week", "2026-10-10");
  const days = [day("2026-10-05", 2000, 100, 200, 60, 4), day("2026-10-06", 1500, 90.5, 150, 40.4, 3), day("2026-10-08", 1799, 80, 180, 50, 2)];

  it("averages over the days that were logged, not over the calendar", () => {
    const s = summarize(days, week, "2026-10-10");
    expect(s.loggedDays).toBe(3);
    expect(s.elapsedDays).toBe(6);
    expect(s.total).toEqual({ calories: 5299, protein: 270.5, carbs: 530, fat: 150.4 });
    expect(s.average).toEqual({ calories: 1766, protein: 90.2, carbs: 176.7, fat: 50.1 }); // 5299/3, not /6 or /7
  });
  it("gives average, highest and lowest day for calories and every macro", () => {
    const { stats } = summarize(days, week, "2026-10-10");
    expect(stats?.calories).toEqual({ average: 1766, max: { date: "2026-10-05", value: 2000 }, min: { date: "2026-10-06", value: 1500 } });
    expect(stats?.protein).toEqual({ average: 90.2, max: { date: "2026-10-05", value: 100 }, min: { date: "2026-10-08", value: 80 } });
    expect(stats?.carbs).toEqual({ average: 176.7, max: { date: "2026-10-05", value: 200 }, min: { date: "2026-10-06", value: 150 } });
    expect(stats?.fat).toEqual({ average: 50.1, max: { date: "2026-10-05", value: 60 }, min: { date: "2026-10-06", value: 40.4 } });
  });
  it("takes the earliest day on a tie, and one logged day is both highest and lowest", () => {
    const tie = summarize([day("2026-10-07", 1800), day("2026-10-06", 1800), day("2026-10-08", 1800)], week, "2026-10-10");
    expect(tie.stats?.calories.max?.date).toBe("2026-10-06");
    expect(tie.stats?.calories.min?.date).toBe("2026-10-06");
    const one = summarize([day("2026-10-07", 1234, 50)], week, "2026-10-10");
    expect(one.stats?.calories).toEqual({ average: 1234, max: { date: "2026-10-07", value: 1234 }, min: { date: "2026-10-07", value: 1234 } });
  });
  it("leaves today out of the highest and lowest day (it is not over), but not out of the average", () => {
    const withToday = summarize([...days, day("2026-10-09", 300, 10, 20, 5)], week, "2026-10-09");
    expect(withToday.loggedDays).toBe(4);
    expect(withToday.stats?.calories.min).toEqual({ date: "2026-10-06", value: 1500 }); // not today's 300
    expect(withToday.stats?.calories.max).toEqual({ date: "2026-10-05", value: 2000 });
    expect(withToday.stats?.calories.average).toBe(1400); // (5299 + 300) / 4
  });
  it("has no highest or lowest day when today is the only one logged", () => {
    const onlyToday = summarize([day("2026-10-09", 300, 10, 20, 5)], week, "2026-10-09");
    expect(onlyToday.stats?.calories).toEqual({ average: 300, max: null, min: null });
  });
  it("ignores days outside the period and days without entries", () => {
    const s = summarize([...days, day("2026-10-12", 9999), day("2026-10-07", 777, 0, 0, 0, 0)], week, "2026-10-10");
    expect(s.loggedDays).toBe(3);
    expect(s.total.calories).toBe(5299);
  });
  it("has no average or stats when nothing was logged", () => {
    expect(summarize([], week, "2026-10-10")).toMatchObject({ loggedDays: 0, average: null, stats: null });
  });
});

describe("niceMax / valueOf", () => {
  it("rounds up to a clean axis top, for kcal and for grams", () => {
    expect(niceMax(2049)).toBe(2500);
    expect(niceMax(2520)).toBe(3000);
    expect(niceMax(71)).toBe(80);
    expect(niceMax(207)).toBe(250);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(0.45)).toBe(0.5);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(101)).toBe(120);
  });
  it("never goes below the value and has a floor for empty data", () => {
    for (const v of [0.3, 7, 19.9, 55, 333, 999, 1500, 4700, 12345]) expect(niceMax(v)).toBeGreaterThanOrEqual(v);
    expect(niceMax(0)).toBe(10);
  });
  it("reads a metric of a bucket, or null when it is empty", () => {
    const [b] = bucketize([day("2026-10-06", 1500, 90)], periodFor("week", "2026-10-10")).filter((x) => x.average);
    expect(valueOf(b!, "calories")).toBe(1500);
    expect(valueOf(b!, "protein")).toBe(90);
    expect(valueOf({ average: null }, "fat")).toBeNull();
  });
});

describe("macroSplit", () => {
  it("is each macro's share of the calories (4/4/9 kcal per gram)", () => {
    // 320.4 + 780 + 518.4 kcal = 48.19% carbs, 32.02% fat, 19.79% protein
    expect(macroSplit({ protein: 80.1, carbs: 195, fat: 57.6 })).toEqual({ protein: 20, carbs: 48, fat: 32 });
    expect(macroSplit({ protein: 100, carbs: 0, fat: 0 })).toEqual({ protein: 100, carbs: 0, fat: 0 });
  });
  it("always adds up to exactly 100", () => {
    for (const [p, c, f] of [[33.3, 33.3, 33.3], [1, 1, 1], [120.7, 210.2, 64.9], [0.1, 0.1, 0.1], [50, 0, 50]] as const) {
      const { protein, carbs, fat } = macroSplit({ protein: p, carbs: c, fat: f });
      expect(protein + carbs + fat, `${p}/${c}/${f}`).toBe(100);
    }
  });
  it("is all zeros when nothing was eaten", () => {
    expect(macroSplit({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("granularityFor / bucketize", () => {
  it("chooses days, weeks or months by the length of the period", () => {
    expect(granularityFor(periodFor("week", "2026-10-10"))).toBe("day");
    expect(granularityFor(periodFor("month", "2026-10-10"))).toBe("day"); // 31 days
    expect(granularityFor(custom("2026-10-01", "2026-11-01"))).toBe("week"); // 32 days
    expect(granularityFor(custom("2026-01-01", "2026-07-09"))).toBe("week"); // 190 days
    expect(granularityFor(custom("2026-01-01", "2026-07-10"))).toBe("month"); // 191 days
    expect(granularityFor(periodFor("year", "2026-10-10"))).toBe("month");
  });

  it("gives one bucket per day for a week, empty days included", () => {
    const week = periodFor("week", "2026-10-10");
    const buckets = bucketize([day("2026-10-06", 1500, 90)], week);
    expect(buckets).toHaveLength(7);
    expect(buckets.map((b) => b.loggedDays)).toEqual([0, 1, 0, 0, 0, 0, 0]);
    expect(buckets[1]?.average).toEqual({ calories: 1500, protein: 90, carbs: 0, fat: 0 });
    expect(buckets[0]?.average).toBeNull();
  });

  it("gives 12 months for a year, each averaged over its logged days", () => {
    const year = periodFor("year", "2026-10-10");
    const buckets = bucketize([day("2026-03-01", 2000), day("2026-03-02", 1000), day("2026-12-31", 1800)], year);
    expect(buckets).toHaveLength(12);
    expect(buckets[2]).toMatchObject({ from: "2026-03-01", to: "2026-03-31", loggedDays: 2, average: { calories: 1500 } });
    expect(buckets[11]).toMatchObject({ loggedDays: 1, average: { calories: 1800 } });
    expect(buckets[0]?.average).toBeNull();
  });

  it("clips weeks to a custom range that starts and ends mid-week", () => {
    const buckets = bucketize([], custom("2026-01-15", "2026-03-10"));
    expect(buckets).toHaveLength(9);
    expect(buckets[0]).toMatchObject({ from: "2026-01-15", to: "2026-01-18", granularity: "week" });
    expect(buckets.at(-1)).toMatchObject({ from: "2026-03-09", to: "2026-03-10" });
    for (let i = 1; i < buckets.length; i++) expect(buckets[i]!.from > buckets[i - 1]!.to).toBe(true); // no overlaps
  });

  it("covers every day exactly once, whatever the granularity", () => {
    for (const period of [periodFor("month", "2028-02-10"), periodFor("year", "2028-02-10"), custom("2026-01-15", "2026-03-10")]) {
      const buckets = bucketize([], period);
      expect(buckets.reduce((n, b) => n + spanDays(b.from, b.to), 0)).toBe(spanDays(period.from, period.to));
    }
  });
});

describe("bucketize never shows days that have not happened yet", () => {
  it("ends the current month, week and year today", () => {
    const month = bucketize([], periodFor("month", "2026-10-10"), "2026-10-10");
    expect(month).toHaveLength(10);
    expect(month.at(-1)).toMatchObject({ from: "2026-10-10", to: "2026-10-10" });
    expect(bucketize([], periodFor("week", "2026-10-10"), "2026-10-07").map((b) => b.from)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    const year = bucketize([], periodFor("year", "2026-10-10"), "2026-10-10");
    expect(year).toHaveLength(10); // Jan to Oct
    expect(year.at(-1)).toMatchObject({ from: "2026-10-01", to: "2026-10-10" }); // October is partial
  });
  it("clips the last week of a range that includes today", () => {
    const buckets = bucketize([], custom("2026-09-01", "2026-11-30"), "2026-10-10");
    expect(buckets.at(-1)).toMatchObject({ granularity: "week", to: "2026-10-10" });
  });
  it("leaves past periods whole and a period that has not started empty", () => {
    expect(bucketize([], periodFor("month", "2026-01-10"), "2026-10-10")).toHaveLength(31);
    expect(bucketize([], periodFor("week", "2099-01-04"), "2026-10-10")).toEqual([]);
  });
  it("still covers every day when no 'today' is given", () => {
    expect(bucketize([], periodFor("month", "2026-10-10"))).toHaveLength(31);
  });
});

describe("labels and links", () => {
  const week = periodFor("week", "2026-10-10");
  it("labels buckets and axis ticks", () => {
    const days = bucketize([], week);
    expect(bucketLabel(days[0]!)).toBe("Mon, 5 Oct");
    expect(days.map((b, i) => axisLabel(b, i, days.length, "week"))).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    const month = bucketize([], periodFor("month", "2026-10-10"));
    const ticks = month.map((b, i) => axisLabel(b, i, month.length, "month")).filter(Boolean);
    expect(ticks).toEqual(["1", "5", "10", "15", "20", "25", "30"]);
    const year = bucketize([], periodFor("year", "2026-10-10"));
    expect(year.map((b, i) => axisLabel(b, i, year.length, "year")).join("")).toBe("JFMAMJJASOND");
    // the first days of a month are numbered, not turned into weekday letters
    const early = bucketize([], periodFor("month", "2026-10-10"), "2026-10-04");
    expect(early.map((b, i) => axisLabel(b, i, early.length, "month")).filter(Boolean)).toEqual(["1"]);
    expect(bucketLabel(year[9]!)).toBe("October");
  });
  it("opens a day in Hoje and drills weeks and months into their own period", () => {
    const days = bucketize([], week);
    expect(bucketHref(days[0]!, now)).toBe("/?d=2026-10-05");
    expect(bucketHref(days[5]!, now)).toBe("/"); // today
    const year = bucketize([], periodFor("year", "2026-10-10"));
    expect(bucketHref(year[2]!, now)).toBe("/history?p=month&d=2026-03-01");
    const weeks = bucketize([], custom("2026-01-15", "2026-03-10"));
    expect(bucketHref(weeks[1]!, now)).toBe("/history?p=week&d=2026-01-19");
  });
});

describe("percentChange", () => {
  it("is the whole-number change against the previous value", () => {
    expect(percentChange(2120, 2000)).toBe(6);
    expect(percentChange(1940, 2000)).toBe(-3);
    expect(percentChange(2000, 2000)).toBe(0);
    expect(percentChange(1, 3)).toBe(-67);
  });
  it("is null when there is nothing to compare with", () => {
    expect(percentChange(2000, null)).toBeNull();
    expect(percentChange(2000, undefined)).toBeNull();
    expect(percentChange(2000, 0)).toBeNull();
  });
});

describe("previousPeriod", () => {
  it("is the period right before, of the same kind", () => {
    expect(previousPeriod(periodFor("week", "2026-10-10"))).toEqual(periodFor("week", "2026-10-03"));
    expect(previousPeriod(periodFor("month", "2026-10-10"))).toEqual(periodFor("month", "2026-09-10"));
    expect(previousPeriod(periodFor("year", "2026-10-10"))).toEqual(periodFor("year", "2025-10-10"));
  });
  it("is the same number of days before a range", () => {
    expect(previousPeriod({ kind: "custom", from: "2026-10-05", to: "2026-10-11" })).toEqual({ kind: "custom", from: "2026-09-28", to: "2026-10-04" });
    expect(previousPeriod({ kind: "custom", from: "2026-10-10", to: "2026-10-10" })).toEqual({ kind: "custom", from: "2026-10-09", to: "2026-10-09" });
  });
});

describe("wholePercents / mealShares", () => {
  it("makes whole percentages that add up to exactly 100", () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
    expect(wholePercents([]).length).toBe(0);
    const p = wholePercents([333, 333, 334, 1]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("macroSplit still adds up to 100", () => {
    const split = macroSplit({ protein: 150, carbs: 200, fat: 67 });
    expect(split.protein + split.carbs + split.fat).toBe(100);
  });
  it("splits the calories between the four meals in the order of the day", () => {
    const shares = mealShares(
      [
        { meal: "lunch", calories: 1200 },
        { meal: "breakfast", calories: 400 },
        { meal: "lunch", calories: 400 },
        { meal: "snacks", calories: 400 },
      ],
      2,
    );
    expect(shares.map((s) => s.meal)).toEqual(["breakfast", "lunch", "dinner", "snacks"]);
    expect(shares.map((s) => s.percent)).toEqual([17, 66, 0, 17]);
    expect(shares.reduce((a, s) => a + s.percent, 0)).toBe(100);
    expect(shares.map((s) => s.perDay)).toEqual([200, 800, 0, 200]);
  });
  it("is all zeros when nothing was logged", () => {
    expect(mealShares([], 0).every((s) => s.percent === 0 && s.perDay === 0)).toBe(true);
  });
});

describe("training in the history", () => {
  const week = periodFor("week", "2026-10-07"); // Mon 5 to Sun 11 Oct 2026
  const counts = [
    { date: "2026-10-05", trainings: 1 },
    { date: "2026-10-07", trainings: 2 },
    { date: "2026-10-09", trainings: 1 },
    { date: "2026-10-12", trainings: 3 }, // next week
    { date: "2026-10-04", trainings: 1 }, // the week before
  ];

  it("counts the trainings and the days with training inside the period only", () => {
    expect(summarizeTraining(counts, week)).toEqual({ trainings: 4, days: 3 });
    expect(summarizeTraining([], week)).toEqual({ trainings: 0, days: 0 });
    expect(summarizeTraining([{ date: "2026-10-06", trainings: 0 }], week)).toEqual({ trainings: 0, days: 0 });
    expect(summarizeTraining(counts, periodFor("month", "2026-10-07"))).toEqual({ trainings: 8, days: 5 });
  });

  it("has a bucket for each day of a week with how many trainings it holds", () => {
    const buckets = trainingBuckets(counts, week, "2026-10-31");
    expect(buckets.map((b) => b.from)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 2, 0, 1, 0, 0]);
    expect(buckets.map((b) => b.trained)).toEqual([true, false, true, false, true, false, false]);
    expect(buckets.every((b) => b.granularity === "day")).toBe(true);
  });

  it("leaves out the days that have not happened yet, like the calorie bars", () => {
    const buckets = trainingBuckets(counts, week, "2026-10-08");
    expect(buckets.map((b) => b.from)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]);
  });

  it("groups a long period by week or by month", () => {
    const quarter = { kind: "custom" as const, from: "2026-07-01", to: "2026-12-31" };
    const weekly = trainingBuckets([{ date: "2026-07-02", trainings: 2 }, { date: "2026-07-08", trainings: 1 }], { ...quarter, to: "2026-08-31" }, "2026-12-31");
    expect(weekly[0]).toMatchObject({ granularity: "week", count: 2, trained: true });
    expect(weekly[1]).toMatchObject({ count: 1 });
    const yearly = trainingBuckets([{ date: "2026-03-10", trainings: 4 }, { date: "2026-03-20", trainings: 1 }, { date: "2026-05-01", trainings: 2 }], periodFor("year", "2026-06-01"), "2026-12-31");
    expect(yearly).toHaveLength(12);
    expect(yearly[2]).toMatchObject({ granularity: "month", from: "2026-03-01", count: 5 });
    expect(yearly[4]).toMatchObject({ count: 2 });
    expect(yearly[0]).toMatchObject({ count: 0, trained: false });
  });

  it("compares with the period before only when that one had trainings", () => {
    expect(percentChange(4, 2)).toBe(100);
    expect(percentChange(4, 0)).toBeNull();
    expect(percentChange(4, undefined)).toBeNull();
  });
});
