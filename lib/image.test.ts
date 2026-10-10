import { describe, expect, it } from "vitest";
import { dataUrlToBase64, fitWithin } from "./image";

describe("fitWithin", () => {
  it("scales the longest side down to max, keeping the ratio", () => {
    expect(fitWithin(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 });
    expect(fitWithin(2000, 2000, 768)).toEqual({ width: 768, height: 768 });
  });
  it("never upscales", () => {
    expect(fitWithin(640, 480, 1024)).toEqual({ width: 640, height: 480 });
  });
  it("keeps at least 1px for extreme ratios", () => {
    expect(fitWithin(10_000, 2, 1024)).toEqual({ width: 1024, height: 1 });
  });
  it("rejects non-positive dimensions", () => {
    expect(() => fitWithin(0, 100, 1024)).toThrow(RangeError);
    expect(() => fitWithin(100, Number.NaN, 1024)).toThrow(RangeError);
  });
});

describe("dataUrlToBase64", () => {
  it("strips the data URL prefix", () => {
    expect(dataUrlToBase64("data:image/jpeg;base64,/9j/4AAQ")).toBe("/9j/4AAQ");
  });
  it("returns empty for a malformed data URL (e.g. 'data:,' from a failed canvas)", () => {
    expect(dataUrlToBase64("data:,")).toBe("");
    expect(dataUrlToBase64("garbage")).toBe("");
  });
});
