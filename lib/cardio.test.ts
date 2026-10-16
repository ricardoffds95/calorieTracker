import { describe, expect, it } from "vitest";
import { estimateCalories, formatDuration, parseMinutes, stepMinutes, validateCardio } from "./cardio";

describe("estimateCalories", () => {
  it("is MET × kg × hours, whole", () => {
    expect(estimateCalories(8, 80, 30)).toBe(320); // running, 30 min
    expect(estimateCalories(6.8, 72.5, 45)).toBe(370); // 6.8 × 72.5 × 0.75 = 369.75
    expect(estimateCalories(4, 60, 90)).toBe(360);
  });
  it("gives nothing without a MET, a weight or a time", () => {
    expect(estimateCalories(null, 80, 30)).toBeNull();
    expect(estimateCalories(undefined, 80, 30)).toBeNull();
    expect(estimateCalories(8, null, 30)).toBeNull();
    expect(estimateCalories(8, 0, 30)).toBeNull();
    expect(estimateCalories(8, 80, 0)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("says minutes, then hours", () => {
    expect(formatDuration(1)).toBe("1 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(65)).toBe("1 h 5 min");
    expect(formatDuration(125)).toBe("2 h 5 min");
    expect(formatDuration(1440)).toBe("24 h");
  });
});

describe("minutes", () => {
  it("reads whole numbers only", () => {
    expect(parseMinutes("30")).toBe(30);
    expect(parseMinutes(" 45 ")).toBe(45);
    for (const bad of ["", "1.5", "1,5", "-3", "abc"]) expect(parseMinutes(bad)).toBeNull();
  });
  it("steps by five inside 1 to 1440", () => {
    expect(stepMinutes(30, 1)).toBe(35);
    expect(stepMinutes(30, -1)).toBe(25);
    expect(stepMinutes(3, -1)).toBe(1);
    expect(stepMinutes(1438, 1)).toBe(1440);
    expect(stepMinutes(null, 1)).toBe(35); // from the usual 30
  });
});

describe("validateCardio", () => {
  const ok = { name: "Running", minutes: 30, notes: "" };
  it("accepts a name, 1 to 1440 minutes, and notes", () => {
    expect(validateCardio({ ...ok, name: "  Beach volley ", notes: "  5 km, 5:30/km " })).toEqual({ ok: true, name: "Beach volley", minutes: 30, notes: "5 km, 5:30/km" });
    expect(validateCardio({ ...ok, minutes: 1 })).toMatchObject({ ok: true });
    expect(validateCardio({ ...ok, minutes: 1440 })).toMatchObject({ ok: true });
    expect(validateCardio(ok)).toMatchObject({ notes: null }); // no notes
  });
  it("says what is wrong, in short words", () => {
    expect(validateCardio({ ...ok, name: "   " })).toEqual({ ok: false, message: "Name required" });
    expect(validateCardio({ ...ok, name: "a".repeat(61) })).toEqual({ ok: false, message: "Max 60 characters" });
    for (const minutes of [null, 0, 1441, -5]) expect(validateCardio({ ...ok, minutes })).toEqual({ ok: false, message: "Time: 1 to 1440 min" });
    expect(validateCardio({ ...ok, notes: "x".repeat(1001) })).toEqual({ ok: false, message: "Notes: max 1000 characters" });
    expect(validateCardio({ ...ok, notes: "x".repeat(1000) })).toMatchObject({ ok: true });
  });
});
