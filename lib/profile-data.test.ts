import { describe, expect, it } from "vitest";
import { parseProfileData, toProfileDataUpdate, type ProfileDataTexts } from "./profile-data";

const empty: ProfileDataTexts = { name: "Ana", sex: null, age: "", height: "", weight: "", fat: "", daily: null, aerobic: "", anaerobic: "", intensity: null, notes: "" };
const parse = (patch: Partial<ProfileDataTexts>) => parseProfileData({ ...empty, ...patch });

describe("profile data", () => {
  it("accepts a form with only the name; the rest is null", () => {
    const result = parse({});
    expect(result.success).toBe(true);
    expect(toProfileDataUpdate(result.data!)).toEqual({
      name: "Ana",
      sex: null,
      age: null,
      height_cm: null,
      weight_kg: null,
      body_fat_pct: null,
      daily_activity: null,
      aerobic_sessions_per_week: null,
      anaerobic_sessions_per_week: null,
      training_intensity: null,
      training_notes: null,
    });
  });

  it("reads numbers, decimal commas and the rest of the fields", () => {
    const result = parse({ sex: "female", age: "31", height: "168", weight: "61,5", fat: "24.5", daily: "active", aerobic: "3", anaerobic: "0", intensity: "high", notes: "  corrida ao sábado " });
    expect(result.success).toBe(true);
    expect(toProfileDataUpdate(result.data!)).toMatchObject({
      sex: "female",
      age: 31,
      height_cm: 168,
      weight_kg: 61.5,
      body_fat_pct: 24.5,
      daily_activity: "active",
      aerobic_sessions_per_week: 3,
      anaerobic_sessions_per_week: 0,
      training_intensity: "high",
      training_notes: "corrida ao sábado",
    });
  });

  it("trims the name and defaults an empty one to 'Utilizador'", () => {
    expect(parse({ name: "  Ana  " }).data?.name).toBe("Ana");
    expect(parse({ name: "   " }).data?.name).toBe("Utilizador");
  });

  it("rejects names above 50 characters", () => {
    expect(parse({ name: "a".repeat(51) }).success).toBe(false);
    expect(parse({ name: "a".repeat(50) }).success).toBe(true);
  });

  it.each([
    [{ age: "13" }, "A idade mínima é 14 anos."],
    [{ age: "abc" }, "Indica a idade."],
    [{ height: "300" }, "A altura máxima é 250 cm."],
    [{ weight: "12" }, "O peso mínimo é 30 kg."],
    [{ fat: "70" }, "Máximo 60 %."],
    [{ aerobic: "20" }, "Máximo 14 treinos."],
    [{ notes: "x".repeat(2001) }, "As notas podem ter no máximo 2000 caracteres."],
  ] as const)("%j → %s", (patch, message) => {
    const result = parse(patch);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
