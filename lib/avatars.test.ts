import { describe, expect, it } from "vitest";
import { AVATARS, AVATARS_SHOWN, findAvatar } from "./avatars";

describe("avatars", () => {
  it("has nine distinct photos, and the picker shows the first six", () => {
    expect(AVATARS).toHaveLength(9);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(9);
    expect(AVATARS_SHOWN).toBe(6);
    expect(AVATARS.every((a) => a.src === `/avatars/${a.id}.png`)).toBe(true);
  });
  it("finds a stored id, and nothing for an unknown or missing one (the drawn icons of an older version too)", () => {
    expect(findAvatar("photo-2")?.label).toBe("Photo 2");
    expect(findAvatar("icon-flame")).toBeNull();
    expect(findAvatar("nope")).toBeNull();
    expect(findAvatar(null)).toBeNull();
    expect(findAvatar(undefined)).toBeNull();
  });
});
