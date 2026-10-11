import { z } from "zod";
import { planAnswersSchema } from "./nutrition-plan";
import { parseDecimalInput } from "./numbers";
import { DEFAULT_NAME } from "./profile";

/** What the user keeps about themselves (the questionnaire's answers, editable by hand). Everything but the name is optional. */
const shape = planAnswersSchema.shape;
export const profileDataSchema = z.object({
  name: z
    .string()
    .trim()
    .max(50, "Max 50 characters")
    .transform((value) => (value === "" ? DEFAULT_NAME : value)),
  sex: shape.sex.nullable(),
  age: shape.age.nullable(),
  height_cm: shape.height_cm.nullable(),
  weight_kg: shape.weight_kg.nullable(),
  body_fat_pct: shape.body_fat_pct,
  daily_activity: shape.daily_activity.nullable(),
  aerobic_sessions: shape.aerobic_sessions.nullable(),
  anaerobic_sessions: shape.anaerobic_sessions.nullable(),
  intensity: shape.intensity.nullable(),
  notes: shape.notes,
});
export type ProfileData = z.output<typeof profileDataSchema>;

/** The form's texts: blank means "not given" (null); anything that is not a number is NaN so the schema complains. */
export interface ProfileDataTexts {
  name: string;
  sex: string | null;
  age: string;
  height: string;
  weight: string;
  fat: string;
  daily: string | null;
  aerobic: string;
  anaerobic: string;
  intensity: string | null;
  notes: string;
}

const blank = (text: string) => text.trim() === "";
const integer = (text: string) => (blank(text) ? null : /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);
const decimal = (text: string) => (blank(text) ? null : (parseDecimalInput(text) ?? Number.NaN));

export function parseProfileData(texts: ProfileDataTexts) {
  return profileDataSchema.safeParse({
    name: texts.name,
    sex: texts.sex,
    age: integer(texts.age),
    height_cm: integer(texts.height),
    weight_kg: decimal(texts.weight),
    body_fat_pct: decimal(texts.fat),
    daily_activity: texts.daily,
    aerobic_sessions: integer(texts.aerobic),
    anaerobic_sessions: integer(texts.anaerobic),
    intensity: texts.intensity,
    notes: texts.notes,
  });
}

/** Row values to store. */
export function toProfileDataUpdate(data: ProfileData) {
  return {
    name: data.name,
    sex: data.sex,
    age: data.age,
    height_cm: data.height_cm,
    weight_kg: data.weight_kg,
    body_fat_pct: data.body_fat_pct,
    daily_activity: data.daily_activity,
    aerobic_sessions_per_week: data.aerobic_sessions,
    anaerobic_sessions_per_week: data.anaerobic_sessions,
    training_intensity: data.intensity,
    training_notes: data.notes === "" ? null : data.notes,
  };
}
