import { describe, expect, it } from "vitest";
import { AVATARS, findAvatar } from "./avatars";

describe("avatars", () => {
  it("has six distinct choices: three photos and three icons", () => {
    expect(AVATARS).toHaveLength(6);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(6);
    expect(AVATARS.filter((a) => a.kind === "image")).toHaveLength(3);
    expect(AVATARS.filter((a) => a.kind === "icon")).toHaveLength(3);
  });
  it("finds a stored id, and nothing for an unknown or missing one", () => {
    expect(findAvatar("icon-flame")?.label).toBe("Flame");
    expect(findAvatar("nope")).toBeNull();
    expect(findAvatar(null)).toBeNull();
    expect(findAvatar(undefined)).toBeNull();
  });
});
