import { roundCalories } from "./nutrition";
import { parseIntegerInput } from "./profile";

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 1440;
/** The − and + buttons move the time by this much. */
export const MINUTES_STEP = 5;
export const MINUTES_PRESETS = [15, 30, 45, 60] as const;
export const DEFAULT_MINUTES = 30;
export const MAX_ACTIVITY_NAME = 60;
export const MAX_NOTES = 1000;

/**
 * Calories of an activity: MET × body weight (kg) × hours (1 MET is 1 kcal per kg per hour). An estimate, nothing more:
 * null when the activity has no MET or the weight is not known.
 */
export function estimateCalories(met: number | null | undefined, weightKg: number | null | undefined, minutes: number): number | null {
  if (!met || !weightKg || !(minutes > 0)) return null;
  return roundCalories((met * weightKg * minutes) / 60);
}

/** "45 min", "1 h", "1 h 5 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The minutes typed in the field: a whole number, or null for anything else. */
export function parseMinutes(text: string): number | null {
  return parseIntegerInput(text);
}

/** The time moved by one step, kept inside the limits. */
export function stepMinutes(minutes: number | null, direction: -1 | 1): number {
  const base = minutes ?? DEFAULT_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, base + direction * MINUTES_STEP));
}

export type CardioCheck = { ok: true; name: string; minutes: number; notes: string | null } | { ok: false; message: string };

/** A cardio training is valid with a name (the sport, when it is "Other"), 1 to 1440 minutes, and notes up to 1000 characters. */
export function validateCardio(input: { name: string; minutes: number | null; notes: string }): CardioCheck {
  const name = input.name.trim();
  if (name === "") return { ok: false, message: "Name required" };
  if (name.length > MAX_ACTIVITY_NAME) return { ok: false, message: `Max ${MAX_ACTIVITY_NAME} characters` };
  const minutes = input.minutes;
  if (minutes === null || minutes < MIN_MINUTES || minutes > MAX_MINUTES) return { ok: false, message: `Time: ${MIN_MINUTES} to ${MAX_MINUTES} min` };
  const notes = input.notes.trim();
  if (notes.length > MAX_NOTES) return { ok: false, message: `Notes: max ${MAX_NOTES} characters` };
  return { ok: true, name, minutes, notes: notes === "" ? null : notes };
}
