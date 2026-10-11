import { describe, expect, it } from "vitest";
import { addDays, dateKeyOrToday, formatDayLabel, isToday, parseDateKey, toDateKey } from "./dates";

const now = new Date(2026, 9, 10, 15, 30); // 10 Oct 2026 (Saturday), local time

describe("toDateKey / parseDateKey", () => {
  it("formats local dates as YYYY-MM-DD with zero padding", () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });
  it("parses valid keys to a local date", () => {
    const d = parseDateKey("2026-10-10");
    expect(d && toDateKey(d)).toBe("2026-10-10");
    expect(parseDateKey("2024-02-29")).not.toBeNull(); // leap year
  });
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-1-5", "26-10-10", "abc", "", "2026-10-10T10:00", " 2026-10-10"])(
    "rejects %j",
    (bad) => {
      expect(parseDateKey(bad)).toBeNull();
    },
  );
  it("rejects null and undefined", () => {
    expect(parseDateKey(null)).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
  });
});

describe("addDays", () => {
  it("moves across month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-10", 1)).toBe("2026-10-11");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(addDays("2026-10-10", 0)).toBe("2026-10-10");
  });
  it("is not affected by daylight saving changes", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });
  it("throws for an invalid key", () => {
    expect(() => addDays("nope", 1)).toThrow(RangeError);
  });
});

describe("isToday", () => {
  it("compares the local day, ignoring the time", () => {
    expect(isToday("2026-10-10", now)).toBe(true);
    expect(isToday("2026-10-10", new Date(2026, 9, 10, 0, 0, 1))).toBe(true);
    expect(isToday("2026-10-10", new Date(2026, 9, 10, 23, 59, 59))).toBe(true);
    expect(isToday("2026-10-09", now)).toBe(false);
  });
});

describe("formatDayLabel", () => {
  it("uses Today / Yesterday / Tomorrow for neighbouring days", () => {
    expect(formatDayLabel("2026-10-10", now)).toBe("Today, 10 Oct");
    expect(formatDayLabel("2026-10-09", now)).toBe("Yesterday, 9 Oct");
    expect(formatDayLabel("2026-10-11", now)).toBe("Tomorrow, 11 Oct");
  });
  it("uses the weekday for other days", () => {
    expect(formatDayLabel("2026-10-03", now)).toBe("Sat, 3 Oct");
    expect(formatDayLabel("2026-01-15", now)).toBe("Thu, 15 Jan");
  });
  it("works across a month boundary", () => {
    expect(formatDayLabel("2026-09-30", new Date(2026, 9, 1, 8))).toBe("Yesterday, 30 Sep");
  });
  it("returns the key itself when invalid", () => {
    expect(formatDayLabel("garbage", now)).toBe("garbage");
  });
});

describe("dateKeyOrToday", () => {
  it("keeps a valid key and falls back to today otherwise", () => {
    expect(dateKeyOrToday("2026-01-15", now)).toBe("2026-01-15");
    expect(dateKeyOrToday("2026-02-30", now)).toBe("2026-10-10");
    expect(dateKeyOrToday("", now)).toBe("2026-10-10");
    expect(dateKeyOrToday(null, now)).toBe("2026-10-10");
    expect(dateKeyOrToday(undefined, now)).toBe("2026-10-10");
  });
});
