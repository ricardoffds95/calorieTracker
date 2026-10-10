import { z } from "zod";
import { CALORIE_PER_GRAM, GOAL_PRESETS, calculateMacrosFromCalories, type GoalMode, type MacroGoals } from "./macros";

export const MIN_CALORIES = 500;
export const MAX_CALORIES = 10_000;
export const CALORIE_STEP = 50;
export const PERCENT_STEP = 5;
export const DEFAULT_NAME = "Utilizador";

export const GOAL_MODE_OPTIONS: readonly { mode: GoalMode; label: string; description: string }[] = [
  { mode: "cut", label: "Perder peso", description: "Défice calórico" },
  { mode: "maintain", label: "Manter peso", description: "Calorias de manutenção" },
  { mode: "bulk", label: "Ganhar massa", description: "Excedente calórico" },
];

export interface MacroPercentages {
  protein: number;
  carbs: number;
  fat: number;
}

export function presetPercentages(mode: GoalMode): MacroPercentages {
  const { proteinPct, carbsPct, fatPct } = GOAL_PRESETS[mode];
  return { protein: Math.round(proteinPct * 100), carbs: Math.round(carbsPct * 100), fat: Math.round(fatPct * 100) };
}

/**
 * Share of calories each macro represents, as integers that add up to exactly 100.
 * Grams are rounded when stored, so naive rounding can give 99% or 101%
 * (largest remainder method fixes that).
 */
export function percentagesFromGoals(goals: Pick<MacroGoals, "protein" | "carbs" | "fat">): MacroPercentages {
  const calories = [
    goals.protein * CALORIE_PER_GRAM.protein,
    goals.carbs * CALORIE_PER_GRAM.carbs,
    goals.fat * CALORIE_PER_GRAM.fat,
  ];
  const total = calories.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return presetPercentages("maintain");

  const exact = calories.map((c) => (c / total) * 100);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((value, index) => ({ index, remainder: value - floors[index]! })).sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (missing <= 0) break;
    floors[index]! += 1;
    missing -= 1;
  }
  return { protein: floors[0]!, carbs: floors[1]!, fat: floors[2]! };
}

const percent = z.number({ error: "Valor inválido." }).int("Usa números inteiros.").min(0, "Mínimo 0%.").max(100, "Máximo 100%.");

export const profileFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(50, "O nome pode ter no máximo 50 caracteres.")
      .transform((value) => (value === "" ? DEFAULT_NAME : value)),
    mode: z.enum(["cut", "maintain", "bulk"]),
    calories: z
      .number({ error: "Insere um valor de calorias válido." })
      .int("Usa números inteiros.")
      .min(MIN_CALORIES, `Mínimo ${MIN_CALORIES} kcal.`)
      .max(MAX_CALORIES, `Máximo ${MAX_CALORIES} kcal.`),
    proteinPct: percent,
    carbsPct: percent,
    fatPct: percent,
  })
  .refine((v) => v.proteinPct + v.carbsPct + v.fatPct === 100, {
    path: ["total"],
    message: "A soma tem de ser 100%.",
  });

export type ProfileFormValues = z.input<typeof profileFormSchema>;
export type ProfileFormData = z.output<typeof profileFormSchema>;

export interface ProfileUpdate {
  name: string;
  mode: GoalMode;
  goal_calories: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fat: number;
}

/** Row values to store, with grams computed from the percentages. */
export function toProfileUpdate(data: ProfileFormData): ProfileUpdate {
  const goals = calculateMacrosFromCalories(data.calories, data.proteinPct / 100, data.carbsPct / 100, data.fatPct / 100);
  return {
    name: data.name,
    mode: data.mode,
    goal_calories: goals.calories,
    goal_protein: goals.protein,
    goal_carbs: goals.carbs,
    goal_fat: goals.fat,
  };
}

/** For the −/+ buttons: clamps to [min, max]; an empty or invalid current value counts as `fallback`. */
export function stepValue(current: number | null, delta: number, min: number, max: number, fallback = min): number {
  const base = current !== null && Number.isFinite(current) ? current : fallback;
  return Math.min(max, Math.max(min, base + delta));
}

/** Parses a text input into an integer, or null when it is not one. */
export function parseIntegerInput(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}
