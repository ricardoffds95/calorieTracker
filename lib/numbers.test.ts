import { describe, expect, it } from "vitest";
import { parseDecimalInput } from "./numbers";

describe("parseDecimalInput", () => {
  it("accepts integers, dot decimals and comma decimals", () => {
    expect(parseDecimalInput("12")).toBe(12);
    expect(parseDecimalInput("12.5")).toBe(12.5);
    expect(parseDecimalInput("12,5")).toBe(12.5);
    expect(parseDecimalInput(" 0,25 ")).toBe(0.25);
    expect(parseDecimalInput("0")).toBe(0);
  });
  it.each(["", " ", "abc", "-1", "+1", "1e3", "1.2.3", "1,2,3", ".5", "5.", "1 000", "NaN", "Infinity"])("rejects %j", (bad) => {
    expect(parseDecimalInput(bad)).toBeNull();
  });
});
