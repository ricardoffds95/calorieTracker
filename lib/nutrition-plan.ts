import { z } from "zod";
import { CALORIE_PER_GRAM, type GoalMode } from "./macros";

export const INTENSITIES = [
  { key: "low", label: "Leve", description: "Dá para conversar sem esforço" },
  { key: "moderate", label: "Moderada", description: "Respiração acelerada, a suar" },
  { key: "high", label: "Intensa", description: "Perto do limite, difícil falar" },
] as const;
export type Intensity = (typeof INTENSITIES)[number]["key"];

export const DAILY_ACTIVITIES = [
  { key: "sedentary", label: "Sedentário", description: "Quase sempre sentado (teletrabalho, escritório)" },
  { key: "light", label: "Pouco ativo", description: "Algum movimento, mas muito tempo parado" },
  { key: "active", label: "Ativo", description: "Em pé ou a andar a maior parte do dia (loja, saúde, ensino)" },
  { key: "very_active", label: "Muito ativo", description: "Trabalho físico pesado (obras, agricultura, cargas)" },
] as const;
export type DailyActivity = (typeof DAILY_ACTIVITIES)[number]["key"];

export const MAX_NOTES_LENGTH = 2000;

/** What the questionnaire asks. Body fat is optional; the lean mass is 100 − fat. */
export const planAnswersSchema = z.object({
  sex: z.enum(["male", "female"], { error: "Indica o sexo." }),
  age: z.number({ error: "Indica a idade." }).int("Usa números inteiros.").min(14, "A idade mínima é 14 anos.").max(100, "A idade máxima é 100 anos."),
  height_cm: z.number({ error: "Indica a altura." }).int("Usa números inteiros.").min(100, "A altura mínima é 100 cm.").max(250, "A altura máxima é 250 cm."),
  weight_kg: z.number({ error: "Indica o peso." }).min(30, "O peso mínimo é 30 kg.").max(300, "O peso máximo é 300 kg."),
  body_fat_pct: z.number({ error: "Valor inválido." }).min(3, "Mínimo 3 %.").max(60, "Máximo 60 %.").nullable(),
  goal: z.enum(["cut", "maintain", "bulk"], { error: "Escolhe um objetivo." }),
  daily_activity: z.enum(["sedentary", "light", "active", "very_active"], { error: "Indica como é o teu dia a dia." }),
  aerobic_sessions: z.number({ error: "Indica os treinos aeróbicos por semana." }).int("Usa números inteiros.").min(0, "Mínimo 0 treinos.").max(14, "Máximo 14 treinos."),
  anaerobic_sessions: z.number({ error: "Indica os treinos anaeróbicos por semana." }).int("Usa números inteiros.").min(0, "Mínimo 0 treinos.").max(14, "Máximo 14 treinos."),
  intensity: z.enum(["low", "moderate", "high"], { error: "Escolhe a intensidade." }),
  notes: z.string().trim().max(MAX_NOTES_LENGTH, `As notas podem ter no máximo ${MAX_NOTES_LENGTH} caracteres.`),
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

/** How much a session weighs for each intensity. */
const INTENSITY_WEIGHT: Record<Intensity, number> = { low: 0.75, moderate: 1, high: 1.25 };

/** What the day-to-day (the job, the commute, the house) adds on top of the factor of a sedentary person. */
const DAILY_EXTRA: Record<DailyActivity, number> = { sedentary: 0, light: 0.075, active: 0.15, very_active: 0.3 };
const MAX_ACTIVITY_FACTOR = 2.2;

/**
 * Multiplier of the basal rate: the weekly training (aerobic and anaerobic sessions, weighed by their intensity) as for a
 * sedentary person, plus what the day-to-day adds (a builder burns far more than someone working from home).
 */
export function activityFactor(aerobicSessions: number, anaerobicSessions: number, intensity: Intensity, daily: DailyActivity = "sedentary"): number {
  const effective = (aerobicSessions + anaerobicSessions) * INTENSITY_WEIGHT[intensity];
  const training = effective <= 0 ? 1.2 : effective <= 2 ? 1.375 : effective <= 4 ? 1.55 : effective <= 6 ? 1.725 : 1.9;
  return Math.min(MAX_ACTIVITY_FACTOR, Math.round((training + DAILY_EXTRA[daily]) * 1000) / 1000);
}

/** A standard, explainable plan: the safety net around the AI's answer and the fallback when it is not available. */
export function referencePlan(a: PlanAnswers): NutritionPlan {
  const maintenance = basalMetabolicRate(a) * activityFactor(a.aerobic_sessions, a.anaerobic_sessions, a.intensity, a.daily_activity);
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
  return `Cálculo padrão com base em ${method} , no dia a dia ${DAILY_ACTIVITIES.find((d) => d.key === a.daily_activity)?.label.toLowerCase()} e nos ${a.aerobic_sessions + a.anaerobic_sessions} treinos por semana (${INTENSITIES.find((i) => i.key === a.intensity)?.label.toLowerCase()}), com ${goal} e cerca de ${Math.round((a.goal === "cut" ? 2 : a.goal === "bulk" ? 1.8 : 1.6) * 10) / 10} g de proteína por kg.`;
}
