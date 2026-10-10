import { z } from "zod";
import { CALORIE_PER_GRAM, type GoalMode } from "./macros";

export const EXERCISE_TYPES = [
  { key: "cardio", label: "Cardio" },
  { key: "strength", label: "Musculação" },
  { key: "running", label: "Corrida" },
  { key: "cycling", label: "Ciclismo" },
  { key: "swimming", label: "Natação" },
  { key: "racket", label: "Ténis / raquetes" },
  { key: "team", label: "Futebol / equipa" },
  { key: "yoga", label: "Ioga / pilates" },
  { key: "other", label: "Outro" },
] as const;

export const EXERCISE_KEYS = EXERCISE_TYPES.map((t) => t.key) as [string, ...string[]];

/** What the questionnaire asks. Body fat is optional; the lean mass is 100 − fat. */
export const planAnswersSchema = z.object({
  sex: z.enum(["male", "female"], { error: "Indica o sexo." }),
  age: z.number({ error: "Indica a idade." }).int("Usa números inteiros.").min(14, "A idade mínima é 14 anos.").max(100, "A idade máxima é 100 anos."),
  height_cm: z.number({ error: "Indica a altura." }).int("Usa números inteiros.").min(100, "A altura mínima é 100 cm.").max(250, "A altura máxima é 250 cm."),
  weight_kg: z.number({ error: "Indica o peso." }).min(30, "O peso mínimo é 30 kg.").max(300, "O peso máximo é 300 kg."),
  body_fat_pct: z.number({ error: "Valor inválido." }).min(3, "Mínimo 3 %.").max(60, "Máximo 60 %.").nullable(),
  goal: z.enum(["cut", "maintain", "bulk"], { error: "Escolhe um objetivo." }),
  sessions_per_week: z.number({ error: "Indica os treinos por semana." }).int("Usa números inteiros.").min(0, "Mínimo 0.").max(14, "Máximo 14."),
  exercise_types: z.array(z.enum(EXERCISE_KEYS)).max(EXERCISE_KEYS.length),
});
export type PlanAnswers = z.infer<typeof planAnswersSchema>;

export interface NutritionPlan {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const MIN_PLAN_CALORIES = 1200;

/** Fraction of the maintenance calories eaten for each goal. */
const GOAL_FACTOR: Record<GoalMode, number> = { cut: 0.8, maintain: 1, bulk: 1.1 };
/** Grams of protein per kg of body weight for each goal. */
const PROTEIN_PER_KG: Record<GoalMode, number> = { cut: 2, maintain: 1.6, bulk: 1.8 };

/** Basal metabolic rate: Katch-McArdle when the body fat is known, otherwise Mifflin-St Jeor. */
export function basalMetabolicRate(a: Pick<PlanAnswers, "sex" | "age" | "height_cm" | "weight_kg" | "body_fat_pct">): number {
  if (a.body_fat_pct !== null) return 370 + 21.6 * a.weight_kg * (1 - a.body_fat_pct / 100);
  return 10 * a.weight_kg + 6.25 * a.height_cm - 5 * a.age + (a.sex === "male" ? 5 : -161);
}

/** Multiplier of the basal rate for the weekly training. */
export function activityFactor(sessionsPerWeek: number): number {
  if (sessionsPerWeek <= 0) return 1.2;
  if (sessionsPerWeek <= 2) return 1.375;
  if (sessionsPerWeek <= 4) return 1.55;
  if (sessionsPerWeek <= 6) return 1.725;
  return 1.9;
}

/** A standard, explainable plan: the safety net around the AI's answer and the fallback when it is not available. */
export function referencePlan(a: PlanAnswers): NutritionPlan {
  const maintenance = basalMetabolicRate(a) * activityFactor(a.sessions_per_week);
  const calories = Math.max(MIN_PLAN_CALORIES, Math.round((maintenance * GOAL_FACTOR[a.goal]) / 10) * 10);
  const protein_g = Math.round(a.weight_kg * PROTEIN_PER_KG[a.goal]);
  const fat_g = Math.round((calories * 0.25) / CALORIE_PER_GRAM.fat);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * CALORIE_PER_GRAM.protein - fat_g * CALORIE_PER_GRAM.fat) / CALORIE_PER_GRAM.carbs));
  return { calories, protein_g, carbs_g, fat_g };
}

/** What the AI returns. */
export const aiPlanSchema = z.object({
  calories: z.number().finite(),
  protein_g: z.number().finite().min(0),
  carbs_g: z.number().finite().min(0),
  fat_g: z.number().finite().min(0),
  summary: z.string().trim().min(1).max(800),
});

/** How far the AI's calories may be from the reference before it is not trusted. */
const MAX_CALORIE_DEVIATION = 0.25;
/** How far its macros' calories may be from its calories before the carbs are recomputed to fit. */
const MAX_MACRO_MISMATCH = 0.08;

/**
 * The AI's plan made safe: calories inside ±25 % of the reference (otherwise the reference is used), never under the
 * floor, whole numbers, and macros that add up to the calories (the carbs absorb the difference).
 */
export function reconcilePlan(ai: Pick<NutritionPlan, "calories" | "protein_g" | "carbs_g" | "fat_g">, reference: NutritionPlan): { plan: NutritionPlan; trusted: boolean } {
  const deviation = Math.abs(ai.calories - reference.calories) / reference.calories;
  if (!(deviation <= MAX_CALORIE_DEVIATION) || ai.calories < MIN_PLAN_CALORIES) return { plan: reference, trusted: false };

  const calories = Math.round(ai.calories);
  const protein_g = Math.round(ai.protein_g);
  const fat_g = Math.round(ai.fat_g);
  let carbs_g = Math.round(ai.carbs_g);
  const fromMacros = protein_g * CALORIE_PER_GRAM.protein + carbs_g * CALORIE_PER_GRAM.carbs + fat_g * CALORIE_PER_GRAM.fat;
  if (Math.abs(fromMacros - calories) / calories > MAX_MACRO_MISMATCH) {
    carbs_g = Math.round((calories - protein_g * CALORIE_PER_GRAM.protein - fat_g * CALORIE_PER_GRAM.fat) / CALORIE_PER_GRAM.carbs);
    if (carbs_g < 0) return { plan: reference, trusted: false }; // protein and fat alone already exceed the calories
  }
  return { plan: { calories, protein_g, carbs_g, fat_g }, trusted: true };
}

/** The explanation shown with the standard plan. */
export function referenceSummary(a: PlanAnswers): string {
  const goal = a.goal === "cut" ? "um défice de cerca de 20 %" : a.goal === "bulk" ? "um excedente de cerca de 10 %" : "as calorias de manutenção";
  const method = a.body_fat_pct !== null ? "a tua massa magra" : "o teu peso, altura e idade";
  return `Cálculo padrão com base em ${method} e nos ${a.sessions_per_week} treinos por semana, com ${goal} e cerca de ${Math.round((a.goal === "cut" ? 2 : a.goal === "bulk" ? 1.8 : 1.6) * 10) / 10} g de proteína por kg.`;
}
